// backend/models/sql/clubModel.js
const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db");

const Club = sequelize.define(
  "Club",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    slug: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    ownerId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    category: {
      // simple string category;
      type: DataTypes.STRING,
      allowNull: true,
    },
    city: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    lat: {
      type: DataTypes.DECIMAL(9, 6),
      allowNull: true,
    },
    lng: {
      type: DataTypes.DECIMAL(9, 6),
      allowNull: true,
    },
    isPaidMembership: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    membershipFee: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    bannerUrl: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    tableName: "Clubs",
    underscored: false,
  }
);

module.exports = Club;
