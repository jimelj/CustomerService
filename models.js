const { Sequelize, DataTypes } = require('sequelize');

// Initialize Sequelize with SQLite for development (can be changed to PostgreSQL for production)
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './database.sqlite',
  logging: false
});

// Customer Model
const Customer = sequelize.define('Customer', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  firstName: {
    type: DataTypes.STRING(100),
    allowNull: false,
    field: 'first_name'
  },
  lastName: {
    type: DataTypes.STRING(100),
    allowNull: false,
    field: 'last_name'
  },
  address: {
    type: DataTypes.STRING(500),
    allowNull: false
  },
  phoneNumber: {
    type: DataTypes.STRING(20),
    allowNull: true,
    field: 'phone_number'
  }
}, {
  tableName: 'customers',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// Service Request Model
const ServiceRequest = sequelize.define('ServiceRequest', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  customerId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'customer_id',
    references: {
      model: Customer,
      key: 'id'
    }
  },
  intent: {
    type: DataTypes.STRING(20),
    allowNull: false,
    validate: {
      isIn: [['start', 'missed', 'stop']]
    }
  },
  status: {
    type: DataTypes.STRING(20),
    defaultValue: 'pending',
    validate: {
      isIn: [['pending', 'processed', 'completed']]
    }
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'service_requests',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// Call Log Model
const CallLog = sequelize.define('CallLog', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  callSid: {
    type: DataTypes.STRING(100),
    unique: true,
    allowNull: false,
    field: 'call_sid'
  },
  customerId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'customer_id',
    references: {
      model: Customer,
      key: 'id'
    }
  },
  phoneNumber: {
    type: DataTypes.STRING(20),
    allowNull: false,
    field: 'phone_number'
  },
  callStatus: {
    type: DataTypes.STRING(20),
    allowNull: false,
    field: 'call_status'
  },
  duration: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  conversationLog: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'conversation_log'
  }
}, {
  tableName: 'call_logs',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// Define associations
Customer.hasMany(ServiceRequest, { foreignKey: 'customerId', as: 'serviceRequests' });
ServiceRequest.belongsTo(Customer, { foreignKey: 'customerId', as: 'customer' });

Customer.hasMany(CallLog, { foreignKey: 'customerId', as: 'callLogs' });
CallLog.belongsTo(Customer, { foreignKey: 'customerId', as: 'customer' });

module.exports = {
  sequelize,
  Customer,
  ServiceRequest,
  CallLog
};

