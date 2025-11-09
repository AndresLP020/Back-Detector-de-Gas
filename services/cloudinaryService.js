const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path');

class CloudinaryService {
  constructor() {
    // Usar tus credenciales exactas del código Python
    this.configurarCloudinary();
    this.inicializado = false;
    
    this.inicializar();
  }

  // Configurar Cloudinary con tus credenciales
  configurarCloudinary() {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dmki20yzg',
      api_key: process.env.CLOUDINARY_API_KEY || '539762329325969',
      api_secret: process.env.CLOUDINARY_API_SECRET || 'Gr8wnVdJdcbqFd1oVF6hfVQutCI'
    });

    console.log('☁️ Cloudinary configurado:', process.env.CLOUDINARY_CLOUD_NAME || 'dmki20yzg');
  }

  // Inicializar y probar conexión
  async inicializar() {
    try {
      console.log('☁️ Verificando conexión con Cloudinary...');
      
      // Probar conexión
      const resultado = await cloudinary.api.ping();
      
      if (resultado.status === 'ok') {
        this.inicializado = true;
        console.log('✅ Cloudinary conectado correctamente');
      } else {
        throw new Error('Ping falló');
      }
      
    } catch (error) {
      console.error('❌ Error conectando Cloudinary:', error.message);
      this.inicializado = false;
      console.log('⚠️ Continuando sin Cloudinary');
    }
  }

  // Crear archivo temporal con datos del sensor (equivalente a tu archivo .txt)
  crearArchivoTemporal(lecturas) {
    const ahora = new Date();
    const nombreArchivo = `datos_MQ2_${ahora.getFullYear()}${(ahora.getMonth() + 1).toString().padStart(2, '0')}${ahora.getDate().toString().padStart(2, '0')}_${ahora.getHours().toString().padStart(2, '0')}${ahora.getMinutes().toString().padStart(2, '0')}${ahora.getSeconds().toString().padStart(2, '0')}.txt`;
    
    const rutaArchivo = path.join(__dirname, '..', 'temp', nombreArchivo);
    
    // Crear directorio temp si no existe
    const dirTemp = path.dirname(rutaArchivo);
    if (!fs.existsSync(dirTemp)) {
      fs.mkdirSync(dirTemp, { recursive: true });
    }

    // Crear contenido del archivo (equivalente a tu formato Python)
    let contenido = `═══════════════════════════════════════
    REGISTRO DE SENSOR MQ-2
═══════════════════════════════════════
Fecha: ${ahora.toLocaleDateString()}
Hora inicio: ${ahora.toLocaleTimeString()}
Sistema: Node.js Backend
═══════════════════════════════════════

`;

    // Agregar lecturas
    lecturas.forEach((lectura, i) => {
      const timestamp = lectura.timestamp.toLocaleTimeString();
      contenido += `${timestamp} | ${lectura.rawData}\n`;
    });

    // Agregar estadísticas finales
    contenido += `\n═══════════════════════════════════════
Hora fin: ${ahora.toLocaleTimeString()}
Total de registros: ${lecturas.length}
Registro generado automáticamente
═══════════════════════════════════════\n`;

    // Escribir archivo
    fs.writeFileSync(rutaArchivo, contenido, 'utf8');
    
    return { rutaArchivo, nombreArchivo };
  }

  // Subir archivo a Cloudinary (equivalente a tu función subir_a_cloudinary)
  async subirArchivo(rutaArchivo, nombreArchivo) {
    if (!this.inicializado) {
      console.log('⚠️ Cloudinary no disponible, omitiendo subida');
      return null;
    }

    try {
      console.log('☁️ Subiendo a Cloudinary...', nombreArchivo);
      
      const resultado = await cloudinary.uploader.upload(rutaArchivo, {
        resource_type: 'raw',
        public_id: `sensor_mq2/${nombreArchivo}`,
        overwrite: true,
        folder: 'gas-detector'
      });

      console.log('✅ Archivo subido correctamente');
      console.log('🔗 URL:', resultado.secure_url);

      // Limpiar archivo temporal
      if (fs.existsSync(rutaArchivo)) {
        fs.unlinkSync(rutaArchivo);
      }

      return {
        url: resultado.secure_url,
        publicId: resultado.public_id,
        bytes: resultado.bytes,
        createdAt: resultado.created_at
      };

    } catch (error) {
      console.error('❌ Error subiendo a Cloudinary:', error.message);
      return null;
    }
  }

  // Subir datos del sensor (función principal)
  async subirDatosSensor(lecturas) {
    if (!Array.isArray(lecturas) || lecturas.length === 0) {
      console.log('⚠️ No hay lecturas para subir');
      return null;
    }

    try {
      // Crear archivo temporal
      const { rutaArchivo, nombreArchivo } = this.crearArchivoTemporal(lecturas);
      
      // Subir a Cloudinary
      const resultado = await this.subirArchivo(rutaArchivo, nombreArchivo);
      
      if (resultado) {
        console.log(`☁️ ${lecturas.length} lecturas subidas correctamente`);
      }
      
      return resultado;
      
    } catch (error) {
      console.error('❌ Error en proceso de subida:', error.message);
      return null;
    }
  }

  // Subir imagen (para futuras funcionalidades)
  async subirImagen(rutaImagen, nombreImagen) {
    if (!this.inicializado) {
      return null;
    }

    try {
      const resultado = await cloudinary.uploader.upload(rutaImagen, {
        public_id: `gas-detector/images/${nombreImagen}`,
        overwrite: true,
        transformation: [
          { width: 800, height: 600, crop: 'limit' },
          { quality: 'auto' }
        ]
      });

      return {
        url: resultado.secure_url,
        publicId: resultado.public_id
      };

    } catch (error) {
      console.error('❌ Error subiendo imagen:', error.message);
      return null;
    }
  }

  // Obtener archivos subidos
  async obtenerArchivos(limite = 20) {
    if (!this.inicializado) {
      return [];
    }

    try {
      const resultado = await cloudinary.search
        .expression('folder:gas-detector')
        .sort_by([['created_at', 'desc']])
        .max_results(limite)
        .execute();

      return resultado.resources.map(recurso => ({
        url: recurso.secure_url,
        publicId: recurso.public_id,
        createdAt: recurso.created_at,
        bytes: recurso.bytes,
        format: recurso.format
      }));

    } catch (error) {
      console.error('❌ Error obteniendo archivos:', error.message);
      return [];
    }
  }

  // Eliminar archivo
  async eliminarArchivo(publicId) {
    if (!this.inicializado) {
      return false;
    }

    try {
      const resultado = await cloudinary.uploader.destroy(publicId, {
        resource_type: 'raw'
      });

      return resultado.result === 'ok';

    } catch (error) {
      console.error('❌ Error eliminando archivo:', error.message);
      return false;
    }
  }

  // Verificar si está disponible
  estaDisponible() {
    return this.inicializado;
  }

  // Obtener estadísticas de uso
  async obtenerEstadisticas() {
    if (!this.inicializado) {
      return null;
    }

    try {
      const resultado = await cloudinary.api.usage();
      
      return {
        creditos: resultado.credits,
        creditosUsados: resultado.credits_used,
        almacenamiento: resultado.storage,
        ancho: resultado.bandwidth,
        recursos: resultado.resources
      };

    } catch (error) {
      console.error('❌ Error obteniendo estadísticas:', error.message);
      return null;
    }
  }
}

module.exports = CloudinaryService;