// backend/src/models/sql/walletModel.js
const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db");

const Wallet = sequelize.define("Wallet", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  organizerId: {
    // FK → User.id (event organizer)
    type: DataTypes.UUID,
    allowNull: false,
  },
  balanceAvailable: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
  },
  balanceLocked: {
    // for pending payouts, chargebacks etc.
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
  },
  currency: {
    type: DataTypes.STRING(3),
    allowNull: false,
    defaultValue: "INR",
  },
});

module.exports = Wallet;
