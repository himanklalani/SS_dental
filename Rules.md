# Admin Dashboard System Technical Specification

This document provides an exhaustive technical specification for the Admin Dashboard System, covering architecture, features, data flow, API integrations, and production deployment configurations.

## 1. Feature Documentation

### **1.1. Dashboard Analytics**
- **Description**: Provides real-time visibility into message performance and patient engagement.
- **Metrics**: Total Sent, Total Clicked, Total Completed, CTR, and Completion Rate.
- **Implementation**: Fetched via `GET /api/analytics`. Aggregated from the `Message` collection.

### **1.2. Patient Management**
- **Description**: Centralized database for clinic patients.
- **Normalization**: 
    - Names are trimmed and converted to lowercase for consistent lookups.
    - Phone numbers are stripped of non-digits. If the `+` prefix is missing, `+91` (India) is prepended by default to support international dispatch while maintaining domestic compatibility.
- **Duplicate Prevention**: The system uses a combined check of normalized Name + Phone to prevent duplicate patient records during both manual entry and web bookings.

### **1.3. Appointment Management**
- **Status Flow**:
    - `Requested`: Incoming bookings from the external website.
    - `Booked`: Admin-assigned slot or manual entry.
    - `Confirmed`: Patient confirmed or admin manually verified.
    - `Cancelled` / `No-show`: Terminated states.
    - `Completed`: Visit finished, triggers completion workflow.
- **Smart Completion Modal**: 
    - Options: "Just Done", "Send Thank You", or "Send Review Link".
    - Automatically checks if a review link was sent in the last 9 months to prevent spam.
- **Web Booking Approval**: When moving an appointment from `Requested` to `Booked`, the system automatically triggers a **Booking Confirmation** WhatsApp message rather than a "Reschedule" notice.

### **1.4. System Health Monitoring**
- **Description**: Real-time infrastructure monitoring accessible at `/dashboard/health`.
- **Checks**:
    - **Database**: Verifies active MongoDB connection.
    - **Backend**: Checks API responsiveness.
    - **WhatsApp**: Verifies Meta API configuration and token validity.
- **Endpoint**: `GET /api/health` returns status for both automated checks and human-readable monitoring.

---

## 2. Technical Architecture

### **2.1. Tech Stack**
- **Frontend**: Next.js (App Router), Tailwind CSS (Dark Mode First), Lucide Icons, Axios.
- **Backend**: Node.js, Express, TypeScript.
- **Database**: MongoDB Atlas (Mongoose ODM).
- **Hosting**: Vercel (Frontend), Render (Backend).

### **2.2. Deployment Configuration**
- **Proxying**: The frontend uses `next.config.ts` rewrites to proxy `/api/*` requests to the `BACKEND_URL` (Render).
- **CORS Policy**: Strict whitelist allowing only the production frontend domains (`srsdentalcare.in`, `review-booking-system.vercel.app`) and local development.
- **Trust Proxy**: Backend is configured with `app.set('trust proxy', 1)` to correctly identify client IPs behind Render's reverse proxy for accurate rate limiting.
- **SEO**: `robots.txt` is configured to `Disallow: /` across the entire dashboard to prevent search engine indexing of private clinical data.

---

## 3. API & Security

### **3.1. Public Booking API**
- **Endpoint**: `POST /api/public/book`
- **Security**: Requires a valid `business_id` and `CLINIC_API_KEY` in the request body.
- **Rate Limiting**: Strictly limited to **5 requests per hour per IP address** to prevent bot spam and DoS attacks on the clinical database.

### **3.2. Meta WhatsApp Integration**
- **Provider**: Meta WhatsApp Business API (Official).
- **Configuration**:
    - `META_API_TOKEN`: System User Access Token.
    - `META_PHONE_NUMBER_ID`: Unique ID for the clinic's WhatsApp number.
    - `META_WEBHOOK_VERIFY_TOKEN`: Used for receiving delivery receipts.
- **Message Templates**: Uses official Meta templates (`booking_confirmation`, `appointment_rescheduled`, `appointment_cancelled`, `review_request`).

---

## 4. Environment Variables

### **Frontend (Vercel)**
| Variable | Description |
| :--- | :--- |
| `NEXT_PUBLIC_BUSINESS_ID` | Identifies the clinic for analytics and data filtering. |
| `NEXT_PUBLIC_BACKEND_URL` | Direct URL to the Render API (used for browser-side calls). |
| `BACKEND_URL` | Used by Next.js rewrites for server-side proxying. |

### **Backend (Render)**
| Variable | Description |
| :--- | :--- |
| `MONGO_URI` | MongoDB Atlas connection string. |
| `BUSINESS_ID` | The clinic's unique ID. |
| `CLINIC_API_KEY` | Secret key for validating external booking requests. |
| `META_API_TOKEN` | Meta Graph API authorization token. |

---

## 5. Development Workflow
- **Initialization**: Run `src/scripts/setup_clinic.ts` against the production database to generate the unique Business ID and API Key.
- **Database Migrations**: Handled via Mongoose schema updates; one-time scripts are used for significant data restructuring.

---
*Documentation last updated: 2026-05-07*

