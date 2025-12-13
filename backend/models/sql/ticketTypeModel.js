// backend/models/sql/ticketTypeModel.js
const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db");

const TicketType = sequelize.define("TicketType", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  eventId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING, // e.g. Early Bird, Regular, VIP
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
  },
  quota: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  salesStart: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  salesEnd: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
});

module.exports = TicketType;
