# Google Review AI Agent System

This project is a Google Review AI Agent system with WhatsApp integration for service businesses and e-commerce platforms.

## Architecture

- **Backend**: Node.js, Express, TypeScript, MongoDB (Mongoose), Bull (Queue)
- **Frontend**: Next.js, React, Tailwind CSS, Recharts
- **Integration**: WhatsApp Business API (Twilio placeholder)

## Prerequisites

- Node.js (v18+)
- MongoDB
- Redis (for Queue system)
- Twilio Account (for WhatsApp)

## Setup

### Backend

1. Navigate to `backend` directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure environment variables:
   Copy `.env.example` to `.env` and update values.
   ```bash
   cp .env.example .env
   ```
4. Start development server:
   ```bash
   npm run dev
   ```

### Frontend

1. Navigate to `frontend` directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start development server:
   ```bash
   npm run dev
   ```

## Features

- **Automated Review Requests**: Triggers WhatsApp messages after service completion.
- **Dashboard**: View analytics (Sent, Clicked, Completed).
- **Admin Panel**: Manually trigger review requests.
- **Queue System**: Handles delayed scheduling and reliability.

## API Endpoints

- `POST /api/trigger-review`: Trigger a new review request.
- `POST /api/schedule`: Schedule a review request.
- `GET /api/analytics`: Get performance metrics.
- `POST /api/webhook`: Handle WhatsApp status updates.
