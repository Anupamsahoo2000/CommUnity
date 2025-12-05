"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("Events", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },
      clubId: { type: Sequelize.UUID, allowNull: true },
      title: { type: Sequelize.STRING, allowNull: false },
      slug: { type: Sequelize.STRING, allowNull: false, unique: true },
      description: { type: Sequelize.TEXT, allowNull: true },
      category: { type: Sequelize.STRING, allowNull: true },
      city: { type: Sequelize.STRING, allowNull: true },
      lat: { type: Sequelize.DECIMAL(9, 6), allowNull: true },
      lng: { type: Sequelize.DECIMAL(9, 6), allowNull: true },
      startTime: { type: Sequelize.DATE, allowNull: false },
      endTime: { type: Sequelize.DATE, allowNull: true },
      maxSeats: { type: Sequelize.INTEGER, allowNull: true },
      isFree: { type: Sequelize.BOOLEAN, defaultValue: true },
      basePrice: { type: Sequelize.INTEGER, allowNull: true },
      status: {
        type: Sequelize.ENUM("DRAFT", "PUBLISHED", "CANCELLED", "COMPLETED"),
        defaultValue: "DRAFT",
      },
      bannerUrl: { type: Sequelize.STRING, allowNull: true },
      organizerId: { type: Sequelize.UUID, allowNull: false },
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

    // FKs
    await queryInterface.addConstraint("Events", {
      fields: ["clubId"],
      type: "foreign key",
      name: "fk_events_clubId_clubs_id",
      references: { table: "Clubs", field: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    });

    await queryInterface.addConstraint("Events", {
      fields: ["organizerId"],
      type: "foreign key",
      name: "fk_events_organizerId_users_id",
      references: { table: "Users", field: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });

    await queryInterface.addColumn("Events", "location", {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    // Indexes
    await queryInterface.addIndex("Events", ["city"]);
    await queryInterface.addIndex("Events", ["startTime"]);
    await queryInterface.addIndex("Events", ["category"]);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable("Events");
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_Events_status";'
    );
    await queryInterface.removeColumn("Events", "location");
  },
};
