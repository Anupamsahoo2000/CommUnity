# CommUnity

A location-based clubs and community event discovery and booking platform. Users can search and join events like marathons, cycling, workshops, tech meetups, and social drives utilizing intelligent filters and geo-based discovery. 

The platform operates as a full-scale, production-ready marketplace enabling organizers to manage both free and paid events with real-time bookings, QR-based tickets, and secure payments. 

## 🚀 Key Features
- **Geo-Based Discovery:** Search and discover events based on your exact location.
- **Event & Club Management:** Robust roles for Owners, Moderators, and Members. 
- **Real-Time Communication:** Live event chats and community discussions powered by Socket.io.
- **Ticketing & Payments:** Integrated Cashfree payment gateway, QR tickets, and automatic commission handling.
- **Smart Data & AI:** Gemini AI integration for personalized Chat recommendations.
- **High Performance:** Redis caching layer handles high-traffic ticket rushes seamlessly without overloading the database.

## 🛠 Tech Stack
- **Backend Framework:** Node.js / Express
- **Databases & ORMs:** PostgreSQL (via Sequelize) & MongoDB (via Mongoose)
- **Caching:** Redis
- **File Storage:** AWS S3
- **Payment Gateway:** Cashfree
- **AI Integration:** Google Gemini
- **Frontend:** HTML/CSS/JS

---

## 💻 Local Setup Guide

Follow these steps to get the CommUnity platform running on your local machine.

### 1. Prerequisites
Ensure you have the following services installed and running on your computer:
*   [Node.js](https://nodejs.org/en/)
*   [PostgreSQL](https://www.postgresql.org/)
*   [MongoDB](https://www.mongodb.com/)
*   [Redis](https://redis.io/) ( use Docker)

### 2. Install Dependencies

```bash
# Navigate to the backend directory
cd backend

# Install all required packages
npm install
```

### 3. Database Setup
Create the initial PostgreSQL database on your local machine:
```sql
CREATE DATABASE commUnity_db;
```
*(Note: Our Sequelize ORM handles all the table generation automatically when you start the server).*

### 4. Environment Variables
In the `backend` directory, check your `.env` file. You must make sure your database credentials are correct.

Here are the most critical values to check:
```env
# Postgres (Update with your local postgres user and password)
POSTGRES_HOST=localhost
POSTGRES_DB=commUnity_db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password_here

# MongoDB
MONGO_URL=mongodb://localhost:27017/commUnity_db

# Redis connection (the code automatically defaults to localhost:6379, but you can explicitly set it)
REDIS_URL=redis://localhost:6379 
```

### 5. Running the Application

**Start the Backend Server:**
```bash
cd backend
npm install -g nodemon  # (if you haven't installed nodemon globally)
nodemon server.js 
```

**Serving the Frontend:**
Because the backend serves static assets, you might be able to view the app directly via the backend port. However, for active frontend development, use VS Code's **Live Server** extension on `frontend/index.html` or use a local HTTP server:
```bash
cd frontend
python3 -m http.server 3000
```
Then visit `http://localhost:3000` (or your live server port) in your browser!

---
*Architected for scalability, geo-based insights, and seamless community building.*
