// backend/models/sql/walletTransactionModel.js
const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db");

const WalletTransaction = sequelize.define("WalletTransaction", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  walletId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  type: {
    type: DataTypes.ENUM("CREDIT", "DEBIT"),
    allowNull: false,
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  referenceType: {
    // e.g. BOOKING, PAYOUT, ADJUSTMENT
    type: DataTypes.STRING,
    allowNull: true,
  },
  referenceId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  description: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  meta: {
    type: DataTypes.JSONB,
    allowNull: true,
  },
});

module.exports = WalletTransaction;
