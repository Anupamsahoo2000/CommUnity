// backend/models/sql/ticketTypeModel.js
const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db");

const TicketType = sequelize.define(
  "TicketType",
  {
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
      type: DataTypes.STRING,
      allowNull: false,
    },
    price: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    quota: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: "TicketTypes",
    underscored: false,
  }
);

module.exports = TicketType;
