// backend/models/sql/bookingModel.js
const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db");

const Booking = sequelize.define("Booking", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  eventId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  ticketTypeId: {
    type: DataTypes.UUID,
    allowNull: true, // could be null if you ever support event-level pricing only
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
  },
  status: {
    type: DataTypes.ENUM(
      "PENDING",
      "CONFIRMED",
      "CANCELLED",
      "REFUNDED",
      "EXPIRED"
    ),
    allowNull: false,
    defaultValue: "PENDING",
  },
  totalAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  currency: {
    type: DataTypes.STRING(3),
    allowNull: false,
    defaultValue: "INR",
  },
  holdExpiresAt: {
    // for seat reservation timeout
    type: DataTypes.DATE,
    allowNull: true,
  },
  qrUrl: {
    // S3 URL to the ticket QR
    type: DataTypes.STRING,
    allowNull: true,
  },
});

module.exports = Booking;
