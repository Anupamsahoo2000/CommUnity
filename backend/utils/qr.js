// backend/utils/qr.js
const QRCode = require("qrcode");

/**
 * Generate a PNG buffer for a booking QR.
 * Payload can be anything you want to verify later on check-in.
 */
async function generateBookingQr(booking) {
  // Minimal payload – you can add more fields if you want
  const payload = {
    bookingId: booking.id,
    eventId: booking.eventId,
    userId: booking.userId,
    createdAt: booking.createdAt,
  };

  const text = JSON.stringify(payload);

  // Returns a PNG buffer
  const buffer = await QRCode.toBuffer(text, {
    type: "png",
    errorCorrectionLevel: "M",
    margin: 1,
    width: 400,
  });

  return buffer;
}

module.exports = {
  generateBookingQr,
};
