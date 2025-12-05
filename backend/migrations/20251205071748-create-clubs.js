// backend/migrations/20251205071748-create-clubs.js
"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("Clubs", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal("gen_random_uuid()"), // requires pgcrypto or use Sequelize.UUIDV4 if CLI supports it
        primaryKey: true,
      },
      name: { type: Sequelize.STRING, allowNull: false },
      slug: { type: Sequelize.STRING, allowNull: false, unique: true },
      description: { type: Sequelize.TEXT, allowNull: true },
      ownerId: { type: Sequelize.UUID, allowNull: false },
      category: { type: Sequelize.STRING, allowNull: true },
      city: { type: Sequelize.STRING, allowNull: true },
      lat: { type: Sequelize.DECIMAL(9, 6), allowNull: true },
      lng: { type: Sequelize.DECIMAL(9, 6), allowNull: true },
      isPaidMembership: { type: Sequelize.BOOLEAN, defaultValue: false },
      membershipFee: { type: Sequelize.INTEGER, allowNull: true },
      bannerUrl: { type: Sequelize.STRING, allowNull: true },
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

    // FK: ownerId -> Users(id)
    await queryInterface.addConstraint("Clubs", {
      fields: ["ownerId"],
      type: "foreign key",
      name: "fk_clubs_ownerId_users_id",
      references: { table: "Users", field: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });

    // Index for quick city filtering
    await queryInterface.addIndex("Clubs", ["city"]);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable("Clubs");
  },
};
