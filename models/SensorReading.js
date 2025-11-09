const mongoose = require('mongoose');

// Esquema para las lecturas del sensor MQ-2
const sensorReadingSchema = new mongoose.Schema({
  // Datos principales del sensor
  valorActual: {
    type: Number,
    required: true,
    min: 0
  },
  valorBase: {
    type: Number,
    default: null
  },
  diferencia: {
    type: Number,
    default: 0
  },
  
  // Clasificación del nivel de riesgo
  nivel: {
    type: String,
    enum: ['normal', 'precaucion', 'peligro'],
    default: 'normal'
  },
  
  // Datos de contexto
  timestamp: {
    type: Date,
    default: Date.now,
    index: true  // Índice para consultas rápidas por fecha
  },
  
  // Datos técnicos
  puerto: {
    type: String,
    default: null
  },
  
  // Línea original del Arduino (para debugging)
  rawData: {
    type: String,
    required: true
  },
  
  // Metadatos
  calibrado: {
    type: Boolean,
    default: false
  },
  
  // Información adicional
  temperatura: {
    type: Number,
    default: null
  },
  humedad: {
    type: Number,
    default: null
  }
}, {
  timestamps: true,  // Agrega createdAt y updatedAt automáticamente
  collection: 'sensor_readings'
});

// Índices para optimizar consultas
sensorReadingSchema.index({ timestamp: -1 });
sensorReadingSchema.index({ nivel: 1, timestamp: -1 });
sensorReadingSchema.index({ valorActual: 1 });

// Métodos del esquema
sensorReadingSchema.methods.esAlerta = function() {
  return this.nivel === 'precaucion' || this.nivel === 'peligro';
};

sensorReadingSchema.methods.getRiesgoTexto = function() {
  switch (this.nivel) {
    case 'normal': return 'Normal';
    case 'precaucion': return 'Precaución';
    case 'peligro': return 'Peligro';
    default: return 'Desconocido';
  }
};

// Métodos estáticos
sensorReadingSchema.statics.obtenerUltimasLecturas = function(limite = 100) {
  return this.find()
    .sort({ timestamp: -1 })
    .limit(limite)
    .exec();
};

sensorReadingSchema.statics.obtenerAlertas = function(fechaDesde = null) {
  const query = { 
    nivel: { $in: ['precaucion', 'peligro'] } 
  };
  
  if (fechaDesde) {
    query.timestamp = { $gte: fechaDesde };
  }
  
  return this.find(query)
    .sort({ timestamp: -1 })
    .exec();
};

sensorReadingSchema.statics.obtenerEstadisticas = async function(fechaDesde = null) {
  const matchStage = fechaDesde ? 
    { $match: { timestamp: { $gte: fechaDesde } } } : 
    { $match: {} };
    
  const stats = await this.aggregate([
    matchStage,
    {
      $group: {
        _id: null,
        totalLecturas: { $sum: 1 },
        valorPromedio: { $avg: '$valorActual' },
        valorMaximo: { $max: '$valorActual' },
        valorMinimo: { $min: '$valorActual' },
        alertasTotal: {
          $sum: {
            $cond: [
              { $in: ['$nivel', ['precaucion', 'peligro']] },
              1,
              0
            ]
          }
        },
        alertasPeligro: {
          $sum: {
            $cond: [{ $eq: ['$nivel', 'peligro'] }, 1, 0]
          }
        },
        alertasPrecaucion: {
          $sum: {
            $cond: [{ $eq: ['$nivel', 'precaucion'] }, 1, 0]
          }
        }
      }
    }
  ]);
  
  return stats[0] || {
    totalLecturas: 0,
    valorPromedio: 0,
    valorMaximo: 0,
    valorMinimo: 0,
    alertasTotal: 0,
    alertasPeligro: 0,
    alertasPrecaucion: 0
  };
};

const SensorReading = mongoose.model('SensorReading', sensorReadingSchema);

module.exports = SensorReading;