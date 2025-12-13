// backend/models/sql/paymentModel.js
const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db");

const Payment = sequelize.define("Payment", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  bookingId: {
    type: DataTypes.UUID,
    allowNull: false,
    unique: true, // 1:1 booking → payment
  },
  provider: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: "CASHFREE",
  },
  providerOrderId: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  providerPaymentId: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM("INITIATED", "SUCCESS", "FAILED", "REFUNDED"),
    allowNull: false,
    defaultValue: "INITIATED",
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  currency: {
    type: DataTypes.STRING(3),
    allowNull: false,
    defaultValue: "INR",
  },
  gatewayFee: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  commissionAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  netAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  rawPayload: {
    // optional: store full webhook JSON for debugging
    type: DataTypes.JSONB,
    allowNull: true,
  },
});

module.exports = Payment;
