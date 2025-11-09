const TelegramBot = require('node-telegram-bot-api');

class TelegramService {
  constructor() {
    // Usar tus credenciales exactas del código Python
    this.token = process.env.TELEGRAM_TOKEN || '8209765917:AAG9LED8S0c_vioPqa6Tgm_-1S5NzVN-MkM';
    this.chatId = process.env.TELEGRAM_CHAT_ID || '-4878455642';
    
    this.bot = null;
    this.inicializado = false;
    
    this.inicializar();
  }

  // Inicializar bot de Telegram
  async inicializar() {
    try {
      console.log('📱 Inicializando Telegram Bot...');
      
      this.bot = new TelegramBot(this.token, { polling: false });
      
      // Probar conexión enviando mensaje de prueba
      await this.enviarMensaje('🤖 Sistema de detector de gas iniciado correctamente');
      
      this.inicializado = true;
      console.log('✅ Telegram Bot configurado correctamente');
      
    } catch (error) {
      console.error('❌ Error inicializando Telegram:', error.message);
      this.inicializado = false;
      
      // Continuar sin Telegram si hay error
      console.log('⚠️ Continuando sin notificaciones Telegram');
    }
  }

  // Enviar mensaje (equivalente a tu función enviar_alerta_telegram)
  async enviarMensaje(mensaje, opciones = {}) {
    if (!this.inicializado || !this.bot) {
      console.log('⚠️ Telegram no disponible, mensaje no enviado:', mensaje);
      return false;
    }

    try {
      const opcionesFinal = {
        parse_mode: 'HTML',
        ...opciones
      };

      const resultado = await this.bot.sendMessage(this.chatId, mensaje, opcionesFinal);
      
      console.log('📱 Mensaje Telegram enviado:', mensaje);
      return resultado;
      
    } catch (error) {
      console.error('❌ Error enviando mensaje Telegram:', error.message);
      return false;
    }
  }

  // Enviar alerta de peligro (equivalente a tu sistema de alertas)
  async enviarAlertaPeligro(valorActual, valorBase, diferencia) {
    const mensaje = `🚨 <b>¡ALERTA DE PELIGRO!</b> 🚨
    
🎯 <b>Valor actual:</b> ${valorActual}
📊 <b>Valor base:</b> ${valorBase}
📈 <b>Diferencia:</b> +${diferencia} puntos

⚠️ El sensor detectó un incremento peligroso de gas.
🕒 Tiempo: ${new Date().toLocaleString()}`;

    return await this.enviarMensaje(mensaje);
  }

  // Enviar alerta de precaución
  async enviarAlertaPrecaucion(valorActual, valorBase, diferencia) {
    const mensaje = `⚠️ <b>PRECAUCIÓN</b> ⚠️
    
🎯 <b>Valor actual:</b> ${valorActual}
📊 <b>Valor base:</b> ${valorBase}
📈 <b>Diferencia:</b> +${diferencia} puntos

📢 El sensor detectó un incremento moderado.
🕒 Tiempo: ${new Date().toLocaleString()}`;

    return await this.enviarMensaje(mensaje);
  }

  // Enviar notificación de calibración
  async enviarCalibracion(valorBase) {
    const mensaje = `🎯 <b>Calibración Completada</b> ✅
    
📊 <b>Valor base establecido:</b> ${valorBase}
🕒 Tiempo: ${new Date().toLocaleString()}

El sensor está listo para detectar variaciones de gas.`;

    return await this.enviarMensaje(mensaje);
  }

  // Enviar estado del sistema
  async enviarEstadoSistema(estado) {
    const iconos = {
      iniciado: '🚀',
      conectado: '🔌',
      desconectado: '❌',
      error: '⚠️',
      calibrando: '🎯'
    };

    const icono = iconos[estado.tipo] || '📢';
    
    const mensaje = `${icono} <b>Estado del Sistema</b>
    
📡 <b>Arduino:</b> ${estado.arduino || 'Desconocido'}
🔌 <b>Puerto:</b> ${estado.puerto || 'N/A'}
📊 <b>Estado:</b> ${estado.descripcion}
🕒 <b>Tiempo:</b> ${new Date().toLocaleString()}`;

    return await this.enviarMensaje(mensaje);
  }

  // Enviar resumen diario
  async enviarResumenDiario(estadisticas) {
    const mensaje = `📊 <b>Resumen Diario del Sensor</b>
    
📈 <b>Lecturas totales:</b> ${estadisticas.totalLecturas}
📊 <b>Valor promedio:</b> ${Math.round(estadisticas.valorPromedio || 0)}
📈 <b>Valor máximo:</b> ${estadisticas.valorMaximo || 0}
📉 <b>Valor mínimo:</b> ${estadisticas.valorMinimo || 0}

🚨 <b>Alertas de peligro:</b> ${estadisticas.alertasPeligro || 0}
⚠️ <b>Alertas de precaución:</b> ${estadisticas.alertasPrecaucion || 0}

🕒 Generado: ${new Date().toLocaleString()}`;

    return await this.enviarMensaje(mensaje);
  }

  // Verificar si Telegram está disponible
  estaDisponible() {
    return this.inicializado && this.bot !== null;
  }

  // Obtener información del bot
  async obtenerInfoBot() {
    if (!this.bot) return null;
    
    try {
      return await this.bot.getMe();
    } catch (error) {
      console.error('Error obteniendo info del bot:', error.message);
      return null;
    }
  }

  // Enviar mensaje con teclado personalizado
  async enviarConTeclado(mensaje, teclado) {
    const opciones = {
      reply_markup: {
        inline_keyboard: teclado
      }
    };
    
    return await this.enviarMensaje(mensaje, opciones);
  }

  // Programar mensaje diario (llamar desde cron job)
  programarMensajeDiario() {
    // TODO: Implementar cron job para envío diario automático
    console.log('📅 Programación de mensajes diarios disponible');
  }
}

module.exports = TelegramService;