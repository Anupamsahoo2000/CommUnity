const express = require("express");
const app = express();
const sequelize = require("./config/db");
const mongo = require("./config/mongo");
const cors = require("cors");
const path = require("path");
const http = require("http");
const { initSocket } = require("./config/socket");

const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Import routes
const authRoutes = require("./routes/authRoutes");
const clubRoutes = require("./routes/clubRoutes");
const eventRoutes = require("./routes/eventRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const aiRoutes = require("./routes/aiRoutes");
const hostRoutes = require("./routes/hostRoutes");

// Use routes
app.use("/auth", authRoutes);
app.use("/clubs", clubRoutes);
app.use("/events", eventRoutes);
app.use("/bookings", bookingRoutes);
app.use("/payments", paymentRoutes);
app.use("/ai", aiRoutes);
app.use("/hosts", hostRoutes);

//Sequleize
(async () => {
  try {
    await sequelize.authenticate();
    console.log("Postgres Connection has been established successfully.");
    await sequelize.sync({ alter: true });
  } catch (error) {
    console.error("Unable to connect to the Postgres database:", error);
  }
})();

app.use(express.static(path.join(__dirname, "../frontend")));

const server = http.createServer(app);
initSocket(server);

// Start the server
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
