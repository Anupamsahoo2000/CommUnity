"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("TicketTypes", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },
      eventId: { type: Sequelize.UUID, allowNull: false },
      name: { type: Sequelize.STRING, allowNull: false },
      price: { type: Sequelize.INTEGER, allowNull: true, defaultValue: 0 },
      quota: { type: Sequelize.INTEGER, allowNull: true },
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

    await queryInterface.addConstraint("TicketTypes", {
      fields: ["eventId"],
      type: "foreign key",
      name: "fk_tickettypes_eventId_events_id",
      references: { table: "Events", field: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });

    await queryInterface.addIndex("TicketTypes", ["eventId"]);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable("TicketTypes");
  },
};
