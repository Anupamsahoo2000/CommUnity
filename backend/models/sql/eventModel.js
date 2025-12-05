// backend/src/models/sql/eventModel.js
const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db");

const Event = sequelize.define(
  "Event",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    clubId: {
      type: DataTypes.UUID,
      allowNull: true, // events can be standalone (not part of a club)
    },
    title: {
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
    category: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    city: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    // NEW: original free-text location/address the organizer provided
    location: {
      type: DataTypes.TEXT,
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
    startTime: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    endTime: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    maxSeats: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    isFree: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    basePrice: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("DRAFT", "PUBLISHED", "CANCELLED", "COMPLETED"),
      defaultValue: "DRAFT",
    },
    bannerUrl: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    organizerId: {
      // user who created the event (owner/host)
      type: DataTypes.UUID,
      allowNull: false,
    },
  },
  {
    tableName: "Events",
    underscored: false,
  }
);

module.exports = Event;
