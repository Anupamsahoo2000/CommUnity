// backend/models/sql/index.js
const sequelize = require("../../config/db");
const User = require("./userModel");
const Club = require("./clubModel");
const ClubMember = require("./clubMemberModel");
const Event = require("./eventModel");
const TicketType = require("./ticketTypeModel");

// Club <> User (owner)
Club.belongsTo(User, { foreignKey: "ownerId", as: "owner" });
User.hasMany(Club, { foreignKey: "ownerId", as: "ownedClubs" });

// ClubMember relations
ClubMember.belongsTo(Club, { foreignKey: "clubId", as: "club" });
Club.hasMany(ClubMember, { foreignKey: "clubId", as: "memberships" });

ClubMember.belongsTo(User, { foreignKey: "userId", as: "user" });
User.hasMany(ClubMember, { foreignKey: "userId", as: "clubMemberships" });

// Event <> Club
Event.belongsTo(Club, { foreignKey: "clubId", as: "club" });
Club.hasMany(Event, { foreignKey: "clubId", as: "events" });

// Event <> User (organizer)
Event.belongsTo(User, { foreignKey: "organizerId", as: "organizer" });
User.hasMany(Event, { foreignKey: "organizerId", as: "organizedEvents" });

// TicketType <> Event
TicketType.belongsTo(Event, { foreignKey: "eventId", as: "event" });
Event.hasMany(TicketType, { foreignKey: "eventId", as: "ticketTypes" });

module.exports = {
  User,
  Club,
  ClubMember,
  Event,
  TicketType,
};
