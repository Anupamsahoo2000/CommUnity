// backend/models/sql/clubMemberModel.js
const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db");

const ClubMember = sequelize.define(
  "ClubMember",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    clubId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM("OWNER", "MODERATOR", "MEMBER"),
      defaultValue: "MEMBER",
    },
    status: {
      type: DataTypes.ENUM("ACTIVE", "PENDING", "REJECTED"),
      defaultValue: "ACTIVE",
    },
  },
  {
    tableName: "ClubMembers",
    underscored: false,
  }
);

module.exports = ClubMember;
