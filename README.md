# CommUnity

A location-based clubs and community event discovery and booking platform.

## Features
- Search and discover geo-based events.
- Roles and permissions for Owners, Moderators, and Members.
- Real-time event chats via Socket.io.
- Cashfree payment gateway integration and QR tickets.
- Gemini API integration for chat recommendations.
- Redis caching for high availability.

## Tech Stack
- **Backend:** Node.js, Express
- **Databases & ORMs:** PostgreSQL (Sequelize), MongoDB (Mongoose)
- **Caching:** Redis
- **File Storage:** AWS S3
- **Payment Gateway:** Cashfree
- **AI Integration:** Google Gemini
- **Frontend:** Vanilla HTML/CSS/JS

---

## Local Setup (Docker)

The application supports Docker Compose to spin up the Node.js server, PostgreSQL, MongoDB, and Redis simultaneously.

### Requirements
- Docker & Docker Compose

### Environment Variables
Configure the `.env` file in the `backend` directory. When using Docker, ensure the database credentials match the `docker-compose.yml` defaults.

```bash
cp backend/.env.example backend/.env
```

### Running the application
From the root directory:

```bash
docker compose up --build
```

### Accessing the application
- **Frontend:** `http://localhost:5000`
- **Backend API:** `http://localhost:5000/api`

*To stop the containers:*
```bash
docker compose down
```
