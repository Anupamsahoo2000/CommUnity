// backend/middleware/upload.js
const multer = require("multer");

// Store files in memory, then push to S3
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
  },
});

module.exports = upload;
