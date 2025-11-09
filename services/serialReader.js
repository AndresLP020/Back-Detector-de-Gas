const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const SensorReading = require('../models/SensorReading');

class SerialReader {
  constructor(io, telegramService, cloudinaryService) {
    this.io = io;
    this.telegramService = telegramService;
    this.cloudinaryService = cloudinaryService;
    
    // Estado del sensor
    this.puerto = null;
    this.currentPort = null;
    this.parser = null;
    this.conectado = false;
    
    // Datos de calibración (equivalente a tu código Python)
    this.valorBase = null;
    this.isCalibrated = false;
    
    // Configuración (equivalente a tu código Python)
    this.baudrate = parseInt(process.env.BAUDRATE) || 9600;
    this.umbralPrecaucion = parseInt(process.env.UMBRAL_PRECAUCION) || 15;
    this.umbralPeligro = parseInt(process.env.UMBRAL_PELIGRO) || 60;
    
    // Control de subida a Cloudinary
    this.intervaloSubida = parseInt(process.env.INTERVALO_SUBIDA) || 30;
    this.ultimaSubida = Date.now();
    this.archivoTemp = null;
    
    console.log(`🔧 SerialReader configurado: ${this.baudrate} baud, umbrales: ${this.umbralPrecaucion}/${this.umbralPeligro}`);
  }

  // Equivalente a tu función listar_puertos() en Python
  async detectarPuertos() {
    try {
      const puertos = await SerialPort.list();
      
      console.log('\n🔍 Detectando puertos Arduino...');
      
      if (puertos.length === 0) {
        console.log('❌ No se encontraron puertos COM');
        return [];
      }

      const puertosArduino = puertos.filter(puerto => {
        const desc = puerto.manufacturer?.toLowerCase() || '';
        const prod = puerto.productId?.toLowerCase() || '';
        
        // Detectar Arduino por fabricante común
        return desc.includes('arduino') || 
               desc.includes('ch340') || 
               desc.includes('ftdi') ||
               puerto.vendorId === '2341' || // Arduino LLC
               puerto.vendorId === '1a86';   // CH340 chip
      });

      console.log(`✅ Encontrados ${puertos.length} puertos, ${puertosArduino.length} posibles Arduino:`);
      
      puertos.forEach((puerto, i) => {
        const esArduino = puertosArduino.includes(puerto);
        console.log(`   ${i + 1}. ${puerto.path} - ${puerto.manufacturer || 'Desconocido'} ${esArduino ? '🎯' : ''}`);
      });

      return puertosArduino.length > 0 ? puertosArduino : puertos;
      
    } catch (error) {
      console.error('❌ Error detectando puertos:', error.message);
      return [];
    }
  }

  // Equivalente a tu función seleccionar_puerto() pero automatizada
  async seleccionarPuertoAuto() {
    const puertos = await this.detectarPuertos();
    
    if (puertos.length === 0) {
      throw new Error('No se encontraron puertos disponibles. Conecta tu Arduino.');
    }

    // Intentar conectar a cada puerto hasta encontrar uno que funcione
    for (const puerto of puertos) {
      try {
        console.log(`🔄 Probando ${puerto.path}...`);
        await this.conectarPuerto(puerto.path);
        
        // Si llegamos aquí, la conexión fue exitosa
        console.log(`✅ Arduino detectado en ${puerto.path}`);
        return puerto.path;
        
      } catch (error) {
        console.log(`❌ ${puerto.path} no responde: ${error.message}`);
        continue;
      }
    }
    
    throw new Error('Ningún puerto respondió como Arduino. Verifica la conexión.');
  }

  // Conectar a un puerto específico
  async conectarPuerto(pathPuerto) {
    return new Promise((resolve, reject) => {
      try {
        // Cerrar puerto anterior si existe
        if (this.puerto && this.puerto.isOpen) {
          this.puerto.close();
        }

        this.puerto = new SerialPort({
          path: pathPuerto,
          baudRate: this.baudrate,
          autoOpen: false
        });

        this.parser = this.puerto.pipe(new ReadlineParser({ delimiter: '\n' }));

        // Timeout para la conexión
        const timeout = setTimeout(() => {
          if (!this.conectado) {
            this.puerto.close();
            reject(new Error('Timeout de conexión'));
          }
        }, 5000);

        this.puerto.open((error) => {
          clearTimeout(timeout);
          
          if (error) {
            reject(new Error(`Error abriendo puerto: ${error.message}`));
            return;
          }

          this.currentPort = pathPuerto;
          this.conectado = true;
          
          // Configurar eventos del parser
          this.configurarEventosSerial();
          
          // Actualizar estado en frontend
          if (global.actualizarConexion) {
            global.actualizarConexion(true, pathPuerto, 'Arduino conectado correctamente');
          }

          resolve(pathPuerto);
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  // Configurar eventos de lectura serial
  configurarEventosSerial() {
    this.parser.on('data', (linea) => {
      this.procesarLineaArduino(linea.trim());
    });

    this.puerto.on('close', () => {
      console.log('🔌 Puerto serial cerrado');
      this.conectado = false;
      
      if (global.actualizarConexion) {
        global.actualizarConexion(false, null, 'Arduino desconectado');
      }
    });

    this.puerto.on('error', (error) => {
      console.error('❌ Error en puerto serial:', error.message);
      this.conectado = false;
      
      if (global.actualizarConexion) {
        global.actualizarConexion(false, null, `Error: ${error.message}`);
      }
    });
  }

  // Procesar línea del Arduino (equivalente a tu lógica de procesamiento)
  async procesarLineaArduino(linea) {
    if (!linea || linea.length === 0) return;

    console.log(`📡 Arduino: ${linea}`);

    try {
      // Detectar calibración completa (equivalente a tu código Python)
      if (linea.includes('Calibracion completa. Valor base:')) {
        const match = linea.match(/Valor base:\s*(\d+)/);
        if (match) {
          this.valorBase = parseInt(match[1]);
          this.isCalibrated = true;
          console.log(`🎯 Calibración completada. Valor base: ${this.valorBase}`);
          
          // Enviar notificación de calibración
          if (this.telegramService) {
            this.telegramService.enviarMensaje(`✅ Sensor calibrado correctamente. Valor base: ${this.valorBase}`);
          }
        }
      }

      // Detectar lectura actual (equivalente a tu código Python)
      if (linea.includes('Valor actual:')) {
        await this.procesarLecturaActual(linea);
      }

      // Guardar línea para archivo local (equivalente a tu archivo .txt)
      await this.guardarLineaLocal(linea);

    } catch (error) {
      console.error('❌ Error procesando línea:', error.message);
    }
  }

  // Procesar lectura actual del sensor
  async procesarLecturaActual(linea) {
    try {
      // Extraer valor actual (equivalente a tu regex Python)
      const matchValor = linea.match(/Valor actual:\s*(\d+)/);
      if (!matchValor) return;

      const valorActual = parseInt(matchValor[1]);
      
      if (!this.isCalibrated || this.valorBase === null) {
        console.log('⚠️ Sensor no calibrado aún');
        return;
      }

      const diferencia = valorActual - this.valorBase;
      const nivel = this.clasificarNivel(diferencia);

      // Crear objeto de datos del sensor
      const datosSensor = {
        conectado: true,
        valorActual: valorActual,
        valorBase: this.valorBase,
        diferencia: diferencia,
        nivel: nivel,
        timestamp: new Date(),
        ultimaLectura: linea,
        puerto: this.currentPort
      };

      // Guardar en base de datos
      await this.guardarEnBD(datosSensor, linea);

      // Actualizar frontend en tiempo real
      if (global.actualizarSensorData) {
        global.actualizarSensorData(datosSensor);
      }

      // Sistema de alertas (equivalente a tu código Python)
      await this.procesarAlertas(diferencia, valorActual);

      // Subir a Cloudinary si es necesario
      await this.verificarSubidaCloudinary();

    } catch (error) {
      console.error('❌ Error procesando lectura actual:', error.message);
    }
  }

  // Clasificar nivel de riesgo
  clasificarNivel(diferencia) {
    if (diferencia >= this.umbralPeligro) {
      return 'peligro';
    } else if (diferencia >= this.umbralPrecaucion) {
      return 'precaucion';
    } else {
      return 'normal';
    }
  }

  // Sistema de alertas (equivalente a tu código Python)
  async procesarAlertas(diferencia, valorActual) {
    if (diferencia >= this.umbralPeligro) {
      const mensaje = `🚨 ¡PELIGRO! El valor del sensor aumentó ${diferencia} puntos sobre el valor base (${this.valorBase}). Valor actual: ${valorActual}`;
      
      console.log('🚨 ALERTA DE PELIGRO:', mensaje);
      
      if (this.telegramService) {
        await this.telegramService.enviarMensaje(mensaje);
      }
      
    } else if (diferencia >= this.umbralPrecaucion) {
      const mensaje = `⚠️ Precaución: El valor del sensor aumentó ${diferencia} puntos sobre el valor base (${this.valorBase}). Valor actual: ${valorActual}`;
      
      console.log('⚠️ ALERTA DE PRECAUCIÓN:', mensaje);
      
      if (this.telegramService) {
        await this.telegramService.enviarMensaje(mensaje);
      }
    }
  }

  // Guardar en base de datos
  async guardarEnBD(datosSensor, rawData) {
    try {
      const lectura = new SensorReading({
        valorActual: datosSensor.valorActual,
        valorBase: datosSensor.valorBase,
        diferencia: datosSensor.diferencia,
        nivel: datosSensor.nivel,
        timestamp: datosSensor.timestamp,
        puerto: datosSensor.puerto,
        rawData: rawData,
        calibrado: this.isCalibrated
      });

      await lectura.save();
      
    } catch (error) {
      // Si MongoDB no está disponible, continuar sin guardar
      console.log('⚠️ No se pudo guardar en BD (continuando):', error.message);
    }
  }

  // Guardar línea local (equivalente a tu archivo .txt)
  async guardarLineaLocal(linea) {
    // TODO: Implementar guardado local si es necesario
    // Por ahora, MongoDB maneja el almacenamiento
  }

  // Verificar si es momento de subir a Cloudinary
  async verificarSubidaCloudinary() {
    const ahora = Date.now();
    if (ahora - this.ultimaSubida >= this.intervaloSubida * 1000) {
      try {
        if (this.cloudinaryService) {
          // TODO: Generar archivo temporal y subirlo
          console.log('☁️ Subiendo datos a Cloudinary...');
          this.ultimaSubida = ahora;
        }
      } catch (error) {
        console.error('❌ Error subiendo a Cloudinary:', error.message);
      }
    }
  }

  // Inicializar detector (función principal)
  async inicializar() {
    console.log('\n🚀 Inicializando detector de gas MQ-2...');
    
    try {
      const puerto = await this.seleccionarPuertoAuto();
      console.log(`✅ Detector iniciado en ${puerto}`);
      
      // Enviar notificación de inicio
      if (this.telegramService) {
        this.telegramService.enviarMensaje('🚀 Detector de gas iniciado correctamente');
      }
      
      return puerto;
      
    } catch (error) {
      console.error('❌ Error iniciando detector:', error.message);
      
      // Intentar reconectar cada 10 segundos
      setTimeout(() => {
        console.log('🔄 Intentando reconectar...');
        this.inicializar();
      }, 10000);
      
      throw error;
    }
  }

  // Cerrar conexión
  async cerrar() {
    if (this.puerto && this.puerto.isOpen) {
      console.log('🔌 Cerrando puerto serial...');
      
      try {
        this.puerto.close();
        this.conectado = false;
        
        if (global.actualizarConexion) {
          global.actualizarConexion(false, null, 'Conexión cerrada por el usuario');
        }
        
      } catch (error) {
        console.error('Error cerrando puerto:', error.message);
      }
    }
  }
}

module.exports = SerialReader;