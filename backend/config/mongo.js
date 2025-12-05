const mongoose = require("mongoose");
require("dotenv").config();

// Define the MongoDB connection URL
const mongoURL = process.env.MONGO_URL;

// Set up MongoDB connection
mongoose.connect(mongoURL, {});

// Get the default connection
// Mongoose maintains a default connection object representing the MongoDB connection.
const MongoDB = mongoose.connection;

// Define event listeners for database connection

MongoDB.on("connected", () => {
  console.log("Connected to MongoDB server");
});

MongoDB.on("error", (err) => {
  console.error("MongoDB connection error:", err);
});

MongoDB.on("disconnected", () => {
  console.log("MongoDB disconnected");
});

// Export the database connection
module.exports = MongoDB;
