# Happiffie Reverse Auction Engine

A fully functional, verified reverse auction system prototype for Happiffie (celebration and events marketplace). Clients can post their event requirements, qualified vendors submit competing bids (pricing + pitch), and the engine ranks them in real-time.

* **GitHub Repository**: [happiffie-reverse-auction-engine](https://github.com/Lokeshsrikanth/happiffie-reverse-auction-engine.git)
* **Live Application URL**: [happiffie-reverse-auction-engine.onrender.com](https://happiffie-reverse-auction-engine.onrender.com)

---

## Tech Stack & Architecture

### Backend
* **Runtime**: Node.js + TypeScript
* **Framework**: Express.js
* **ORM**: Prisma Client
* **Database**: PostgreSQL (Docker pgvector/pg15 container locally, Render/Railway/Neon in production)
* **Testing**: Vitest

### Frontend
* Served statically directly via Express (`public/`) to consolidate resources, avoid CORS complexities, and guarantee instant synchronization of frontend and backend states.
* Built using semantic **HTML5**, **Vanilla CSS** featuring a premium glassmorphic celebration aesthetic (Merlot / Burgundy / Champagne Gold theme), and dynamic vanilla **JavaScript** implementing 10-second polling for real-time bid updates.

---

## Getting Started

### 1. Prerequisites
Make sure you have Node.js and Docker (or a local PostgreSQL server) installed.

### 2. Install Dependencies
```bash
npm install
```

### 3. Database Setup
Create a `.env` file at the root of the project with your connection string:
```env
DATABASE_URL="postgresql://username:password@localhost:5435/reverse_auction?schema=public"
PORT=3000
```
Run migrations to set up tables:
```bash
npx prisma migrate dev
```
Populate database with mock vendors, requirements, and bids:
```bash
npm run prisma:seed
```

### 4. Running the App
Start the development server:
```bash
npm run dev
```
Visit `http://localhost:3000` in your web browser.

### 5. Running Tests
Run the automated unit and integration tests:
```bash
npm run test
```

---

## Design and Matching Logic
For detailed information regarding assumptions, user journeys, API specifications, and the exact multi-factor bid scoring formula (Price 50%, Rating 30%, Response History 15%, Timing 5%), please refer to [DESIGN.md](DESIGN.md).
