const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const connectDB = require('./config/database');
const SerialReader = require('./services/serialReader');
const TelegramService = require('./services/telegramService');
const CloudinaryService = require('./services/cloudinaryService');

const app = express();
const server = http.createServer(app);

// Configurar Socket.IO con CORS
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000", // Frontend Next.js
    methods: ["GET", "POST"]
  }
});

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Conectar a MongoDB
connectDB();

// Inicializar servicios
const telegramService = new TelegramService();
const cloudinaryService = new CloudinaryService();
const serialReader = new SerialReader(io, telegramService, cloudinaryService);

// Variables globales para estado del sensor
let sensorData = {
  conectado: false,
  valorActual: 0,
  valorBase: null,
  diferencia: 0,
  nivel: 'normal',
  timestamp: new Date(),
  ultimaLectura: null
};

// Socket.IO - Conexiones en tiempo real
io.on('connection', (socket) => {
  console.log('🔌 Cliente conectado:', socket.id);
  
  // Enviar estado actual al cliente que se conecta
  socket.emit('sensorData', sensorData);
  socket.emit('connectionStatus', { 
    connected: sensorData.conectado,
    message: sensorData.conectado ? 'Arduino conectado' : 'Arduino desconectado'
  });

  // Eventos del cliente
  socket.on('requestSensorData', () => {
    socket.emit('sensorData', sensorData);
  });

  socket.on('disconnect', () => {
    console.log('🔌 Cliente desconectado:', socket.id);
  });
});

// Rutas API REST
app.get('/', (req, res) => {
  res.json({
    message: 'Detector de Gas MQ-2 - API funcionando',
    status: 'online',
    arduino: sensorData.conectado ? 'conectado' : 'desconectado',
    timestamp: new Date()
  });
});

// API - Estado actual del sensor
app.get('/api/sensor/current', (req, res) => {
  res.json(sensorData);
});

// API - Estado de conexión
app.get('/api/sensor/status', (req, res) => {
  res.json({
    conectado: sensorData.conectado,
    puerto: serialReader.currentPort || null,
    ultimaLectura: sensorData.ultimaLectura,
    valorBase: sensorData.valorBase
  });
});

// API - Historial de lecturas (implementar después con MongoDB)
app.get('/api/sensor/history', async (req, res) => {
  // TODO: Implementar consulta a MongoDB
  res.json({ message: 'Historial próximamente disponible' });
});

// API - Configuración de umbrales
app.post('/api/sensor/config', (req, res) => {
  const { umbralPrecaucion, umbralPeligro } = req.body;
  
  if (umbralPrecaucion) {
    process.env.UMBRAL_PRECAUCION = umbralPrecaucion;
    serialReader.umbralPrecaucion = umbralPrecaucion;
  }
  
  if (umbralPeligro) {
    process.env.UMBRAL_PELIGRO = umbralPeligro;
    serialReader.umbralPeligro = umbralPeligro;
  }
  
  res.json({ 
    message: 'Configuración actualizada',
    umbralPrecaucion: serialReader.umbralPrecaucion,
    umbralPeligro: serialReader.umbralPeligro
  });
});

// Inicializar detector de Arduino
const iniciarDetector = async () => {
  console.log('\n🚀 Iniciando Detector de Gas MQ-2...');
  
  try {
    await serialReader.inicializar();
    console.log('✅ Detector iniciado correctamente');
  } catch (error) {
    console.error('❌ Error al iniciar detector:', error.message);
  }
};

// Función para actualizar datos del sensor (llamada por SerialReader)
const actualizarSensorData = (nuevosDatos) => {
  sensorData = { ...sensorData, ...nuevosDatos };
  
  // Enviar a todos los clientes conectados
  io.emit('sensorData', sensorData);
  
  // Si hay una alerta, enviarla también
  if (nuevosDatos.nivel === 'precaucion' || nuevosDatos.nivel === 'peligro') {
    io.emit('alert', {
      tipo: nuevosDatos.nivel,
      mensaje: `${nuevosDatos.nivel.toUpperCase()}: Diferencia de ${nuevosDatos.diferencia} puntos`,
      valorActual: nuevosDatos.valorActual,
      valorBase: nuevosDatos.valorBase,
      timestamp: nuevosDatos.timestamp
    });
  }
};

// Función para actualizar estado de conexión
const actualizarConexion = (conectado, puerto = null, mensaje = '') => {
  sensorData.conectado = conectado;
  if (puerto) serialReader.currentPort = puerto;
  
  io.emit('connectionStatus', { 
    connected: conectado, 
    port: puerto,
    message: mensaje 
  });
  
  console.log(`🔌 Arduino ${conectado ? 'conectado' : 'desconectado'}${puerto ? ` en ${puerto}` : ''}`);
};

// Exponer funciones globales para SerialReader
global.actualizarSensorData = actualizarSensorData;
global.actualizarConexion = actualizarConexion;

// Manejo de cierre graceful
process.on('SIGINT', async () => {
  console.log('\n🛑 Cerrando servidor...');
  
  if (serialReader.puerto) {
    await serialReader.cerrar();
  }
  
  server.close(() => {
    console.log('✅ Servidor cerrado correctamente');
    process.exit(0);
  });
});

// Iniciar servidor
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`\n🌐 Servidor ejecutándose en http://localhost:${PORT}`);
  console.log(`📡 WebSocket disponible para frontend`);
  
  // Iniciar detector después de que el servidor esté listo
  setTimeout(iniciarDetector, 1000);
});

module.exports = { app, server, io };