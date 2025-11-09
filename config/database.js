const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gas-detector';
    
    console.log('📊 Conectando a MongoDB...');
    
    const conn = await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`✅ MongoDB conectado: ${conn.connection.host}`);
    
  } catch (error) {
    console.error('❌ Error de conexión MongoDB:', error.message);
    
    // Si no puede conectar a MongoDB, continuar sin base de datos
    console.log('⚠️  Continuando sin base de datos (solo memoria)');
  }
};

module.exports = connectDB;