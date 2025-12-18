// backend/models/sql/index.js
const sequelize = require("../../config/db");

const User = require("./userModel");
const Club = require("./clubModel");
const ClubMember = require("./clubMemberModel");
const Event = require("./eventModel");
const TicketType = require("./ticketTypeModel");
const Booking = require("./bookingModel");
const Payment = require("./paymentModel");
const Wallet = require("./walletModel");
const WalletTransaction = require("./walletTransactionModel");

// ====================
// Associations
// ====================

// --- Club & ownership ---
Club.belongsTo(User, { foreignKey: "ownerId", as: "owner" });
User.hasMany(Club, { foreignKey: "ownerId", as: "ownedClubs" });

// --- ClubMember relations ---
ClubMember.belongsTo(Club, { foreignKey: "clubId", as: "club" });
Club.hasMany(ClubMember, { foreignKey: "clubId", as: "memberships" });

ClubMember.belongsTo(User, { foreignKey: "userId", as: "user" });
User.hasMany(ClubMember, { foreignKey: "userId", as: "clubMemberships" });

// --- Event & Club ---
Event.belongsTo(Club, { foreignKey: "clubId", as: "club" });
Club.hasMany(Event, { foreignKey: "clubId", as: "events" });

// --- Event & User (organizer) ---
Event.belongsTo(User, { foreignKey: "organizerId", as: "organizer" });
User.hasMany(Event, { foreignKey: "organizerId", as: "organizedEvents" });

// --- TicketType & Event ---
TicketType.belongsTo(Event, { foreignKey: "eventId", as: "event" });
Event.hasMany(TicketType, {
  foreignKey: "eventId",
  onDelete: "CASCADE",
  hooks: true,
  as: "ticketTypes",
});

// ====================
// Booking / Payment
// ====================

// User ↔ Booking
User.hasMany(Booking, {
  foreignKey: "userId",
  as: "bookings",
});
Booking.belongsTo(User, {
  foreignKey: "userId",
  as: "user",
});

// Event ↔ Booking
Event.hasMany(Booking, {
  foreignKey: "eventId",
  as: "bookings",
});
Booking.belongsTo(Event, {
  foreignKey: "eventId",
  as: "event",
});

// TicketType ↔ Booking
TicketType.hasMany(Booking, {
  foreignKey: "ticketTypeId",
  as: "bookings",
});
Booking.belongsTo(TicketType, {
  foreignKey: "ticketTypeId",
  as: "ticketType",
});

// Booking ↔ Payment (1:1)
Booking.hasOne(Payment, {
  foreignKey: "bookingId",
  as: "payment",
});
Payment.belongsTo(Booking, {
  foreignKey: "bookingId",
  as: "booking",
});

// ====================
// Wallet / WalletTransaction
// ====================

// User (organizer) ↔ Wallet
User.hasOne(Wallet, {
  foreignKey: "organizerId",
  as: "wallet",
});
Wallet.belongsTo(User, {
  foreignKey: "organizerId",
  as: "organizer",
});

// Wallet ↔ WalletTransaction
Wallet.hasMany(WalletTransaction, {
  foreignKey: "walletId",
  as: "transactions",
});
WalletTransaction.belongsTo(Wallet, {
  foreignKey: "walletId",
  as: "wallet",
});

// ====================
// Exports
// ====================
module.exports = {
  User,
  Club,
  ClubMember,
  Event,
  TicketType,
  Booking,
  Payment,
  Wallet,
  WalletTransaction,
};
