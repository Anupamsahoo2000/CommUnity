// backend/services/walletService.js
const { Wallet, WalletTransaction } = require("../models/sql");

/**
 * Credit organizer wallet when a booking payment succeeds.
 *
 * booking: Booking instance with .event loaded (must have organizerId)
 * payment: Payment instance for that booking
 * transaction: Sequelize transaction
 *
 * Commission config (from .env):
 *  COMMISSION_PERCENT  → platform commission % (default 10)
 *  GATEWAY_FEE_FLAT    → flat gateway fee per booking (default 0)
 */
async function creditOrganizerWalletForBooking({
  booking,
  payment,
  transaction,
}) {
  const event = booking.event;
  if (!event || !event.organizerId) {
    console.warn("creditOrganizerWalletForBooking: event.organizerId missing");
    return;
  }

  const organizerId = event.organizerId;

  const gross = Number(payment.amount || 0);
  if (!gross || gross <= 0) {
    console.warn(
      "creditOrganizerWalletForBooking: invalid gross amount",
      gross
    );
    return;
  }

  const commissionPercent = Number(process.env.COMMISSION_PERCENT || 10);
  const gatewayFeeFlat = Number(process.env.GATEWAY_FEE_FLAT || 0);

  const commissionAmount = Number(
    ((gross * commissionPercent) / 100).toFixed(2)
  );
  const gatewayFee = Number(gatewayFeeFlat.toFixed(2));
  const netAmount = Number((gross - commissionAmount - gatewayFee).toFixed(2));

  // Update payment financial fields
  payment.commissionAmount = commissionAmount;
  payment.gatewayFee = gatewayFee;
  payment.netAmount = netAmount;
  await payment.save({ transaction });

  // Find or create wallet for organizer
  let wallet = await Wallet.findOne({
    where: { organizerId },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });

  if (!wallet) {
    wallet = await Wallet.create(
      {
        organizerId,
        balanceAvailable: 0,
        balanceLocked: 0,
        currency: payment.currency || "INR",
      },
      { transaction }
    );
  }

  const currentBalance = Number(wallet.balanceAvailable || 0);
  wallet.balanceAvailable = Number((currentBalance + netAmount).toFixed(2));

  await wallet.save({ transaction });

  await WalletTransaction.create(
    {
      walletId: wallet.id,
      type: "CREDIT",
      amount: netAmount,
      referenceType: "BOOKING",
      referenceId: booking.id,
      description: `Payout for booking ${booking.id} (event ${
        event.title || event.id
      })`,
      meta: {
        gross,
        commissionPercent,
        commissionAmount,
        gatewayFee,
      },
    },
    { transaction }
  );
}

module.exports = {
  creditOrganizerWalletForBooking,
};
