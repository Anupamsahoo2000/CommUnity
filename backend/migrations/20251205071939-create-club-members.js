"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("ClubMembers", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },
      clubId: { type: Sequelize.UUID, allowNull: false },
      userId: { type: Sequelize.UUID, allowNull: false },
      role: {
        type: Sequelize.ENUM("OWNER", "MODERATOR", "MEMBER"),
        defaultValue: "MEMBER",
      },
      status: {
        type: Sequelize.ENUM("ACTIVE", "PENDING", "REJECTED"),
        defaultValue: "ACTIVE",
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("NOW()"),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("NOW()"),
      },
    });

    await queryInterface.addConstraint("ClubMembers", {
      fields: ["clubId"],
      type: "foreign key",
      name: "fk_clubmembers_clubId_clubs_id",
      references: { table: "Clubs", field: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });

    await queryInterface.addConstraint("ClubMembers", {
      fields: ["userId"],
      type: "foreign key",
      name: "fk_clubmembers_userId_users_id",
      references: { table: "Users", field: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });

    await queryInterface.addIndex("ClubMembers", ["clubId"]);
    await queryInterface.addIndex("ClubMembers", ["userId"]);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable("ClubMembers");
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_ClubMembers_role";'
    );
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_ClubMembers_status";'
    );
  },
};
