# Admin Dashboard System Technical Specification

This document provides an exhaustive technical specification for the Admin Dashboard System, covering architecture, features, data flow, API integrations, and future migration plans.

## 1. Complete Feature Documentation

### **1.1. Dashboard Analytics**
- **Description**: Provides real-time visibility into message performance and patient engagement.
- **Metrics Tracked**:
    - **Total Sent**: Total number of WhatsApp messages successfully dispatched.
    - **Total Clicked**: Number of unique clicks on review links.
    - **Total Completed**: Number of confirmed review completions.
    - **CTR (Click-Through Rate)**: Ratio of clicks to total messages sent.
    - **Completion Rate**: Ratio of completed reviews to total clicks.
- **Implementation**: Fetched via `GET /api/analytics` endpoint. Data is aggregated from the `Message` collection in MongoDB.

### **1.2. Patient Management**
- **Description**: Centralized database for clinic patients with full CRUD capabilities.
- **Key Actions**:
    - **Add Patient**: Capture name, phone, email, DOB, gender, and medical history.
    - **Edit Patient**: Update existing patient details.
    - **Delete Patient**: Remove patient records from the system.
    - **Search**: Filter patients by name or phone number in real-time.
- **Data Model**: [Patient.ts](file:///c:/Users/Administrator/Desktop/review/backend/src/models/Patient.ts).

### **1.3. Appointment Management**
- **Description**: Comprehensive scheduling system for managing clinic visits.
- **Key Actions**:
    - **Booking**: Assign patients to doctors with specific dates, times, and service types.
    - **Status Tracking**: Manage appointments through states: `Booked`, `Confirmed`, `Cancelled`, `No-show`, `Completed`.
    - **Smart Completion Modal**: Triggered when marking an appointment as "Completed". Offers three choices:
        1. **Just Done**: No message sent.
        2. **Send Thank You**: Automatic appreciation message.
        3. **Send Review Link**: Personalized message with Google Review URL.
    - **Follow-up Scheduling**: Option to book the next visit directly from the completion modal.
- **Data Model**: [Appointment.ts](file:///c:/Users/Administrator/Desktop/review/backend/src/models/Appointment.ts).

### **1.4. WhatsApp Configuration**
- **Description**: Self-service interface for linking and managing the Evolution API instance.
- **Features**:
    - **Live QR Code**: Real-time QR generation for WhatsApp linking.
    - **Connection Status**: Polling every 5 seconds to track state (`open`, `connecting`, `disconnected`).
    - **Hard Reset**: Capability to delete and recreate the API instance to resolve connectivity issues.

### **1.5. System Settings**
- **Description**: Global configuration for clinic-specific parameters.
- **Options**:
    - **Target URL**: Configure the Google Business Review link.
    - **Message Templates**: Customize the wording for automated messages using variables like `{name}` and `{review_url}`.

---

## 2. Theme System Specification

The system uses a **Dark Mode First** aesthetic inspired by modern, minimalist developer tools.

### **2.1. Color Palette**
- **Background**: `bg-black` (Main), `bg-neutral-900` (Cards/Modals), `bg-neutral-950` (Inputs).
- **Borders**: `border-neutral-800` (Subtle), `border-neutral-700` (Interactive).
- **Accents**: 
    - **Emerald**: Success/Connected states (`text-emerald-500`, `bg-emerald-500/10`).
    - **Amber**: Warnings/Pending states (`text-amber-500`).
    - **Blue**: Informational/Action states (`bg-blue-600`).
    - **Red**: Errors/Destructive actions (`text-red-500`).

### **2.2. Typography**
- **Primary**: Inter / Sans-serif for UI elements.
- **Monospaced**: Used for phone numbers, IDs, and variables (`font-mono`) to ensure readability.
- **Weights**: `font-bold` for headers/labels, `font-medium` for body text.

### **2.3. Responsive Breakpoints**
- **Mobile (< 768px)**: Single column layouts, full-width modals, hidden sidebar (accessible via menu).
- **Desktop (>= 768px)**: Multi-column grids, fixed sidebar, centered modals.

---

## 3. Animation Framework

Animations are implemented using **Tailwind CSS** and **Framer Motion** (where applicable) for a smooth user experience.

### **3.1. Core Animations**
- **Fade In**: Applied to page transitions and modal overlays (`animate-fade-in`).
- **Scale In**: Applied to success icons and modal content (`animate-scale-in`).
- **Pulse**: Used for loading states and waiting for API responses.
- **Spin**: Infinite rotation for `Loader2` icons during data fetching.

### **3.2. Micro-interactions**
- **Hover Transitions**: `transition-all duration-200` on buttons and cards.
- **Button Active State**: Subtle scale reduction on click.
- **Modal Backdrop**: 80% opacity black with `backdrop-blur-sm`.

---

## 4. Function-Level Documentation

### **4.1. Frontend Utilities ([api.ts](file:///c:/Users/Administrator/Desktop/review/frontend/app/lib/api.ts))**

| Function | Params | Returns | Description |
| :--- | :--- | :--- | :--- |
| `getAppointments` | `businessId`, `filters` | `Promise<IAppointment[]>` | Fetches filtered appointments. |
| `updateAppointment` | `id`, `data` | `Promise<IAppointment>` | Updates status or details of an appointment. |
| `getWhatsAppQR` | `void` | `Promise<{base64: string}>` | Fetches base64 QR code from Evolution API. |

### **4.2. Backend Controllers ([appointmentController.ts](file:///c:/Users/Administrator/Desktop/review/backend/src/controllers/appointmentController.ts))**

| Method | Endpoint | Logic |
| :--- | :--- | :--- |
| `updateAppointment` | `PUT /api/appointments/:id` | Updates DB, cancels reminders if cancelled, triggers WhatsApp if completed. |
| `getWhatsAppStatus` | `GET /api/whatsapp/status` | Queries Evolution API `connectionState` and returns formatted status. |

---

## 5. System Architecture & Data Flow

### **5.1. Tech Stack**
- **Frontend**: Next.js 16 (App Router), Tailwind CSS, Lucide Icons.
- **Backend**: Node.js, Express, TypeScript.
- **Database**: MongoDB (Mongoose ODM).
- **Task Scheduling**: `node-cron` for appointment reminders.

### **5.2. Data Flow: Appointment Completion**
1. User clicks **"Done & Send Review"** in Frontend.
2. Frontend calls `PUT /api/appointments/:id` with `message_type: 'review'`.
3. Backend updates Appointment status to `Completed`.
4. Backend checks if a `Customer` record exists; creates one if not.
5. Backend calls `queueReviewRequest` (immediate execution).
6. `processReviewJob` calls `sendWhatsAppMessage`.
7. `sendWhatsAppMessage` prioritizes **Evolution API** for delivery.

---

## 6. API Integration Details

### **6.1. Evolution API**
- **Base URL**: `EVOLUTION_API_URL` (Default: `http://localhost:8080`)
- **Authentication**: `apikey` header.
- **Key Endpoints**:
    - `GET /instance/connect/{instance}`: Fetch QR code.
    - `GET /instance/connectionState/{instance}`: Check link status.
    - `POST /message/sendText/{instance}`: Dispatch WhatsApp messages.
- **Error Handling**: Graceful fallback to "Disconnected" state if the instance is missing (404).

---

## 7. Validation Framework

### **7.1. Frontend Validation**
- **Required Fields**: Enforced via HTML5 `required` attribute on forms.
- **Format Validation**: `type="tel"` for phones, `type="email"` for emails.
- **State Protection**: Buttons are disabled during `loading` or `saving` states.

### **7.2. Backend Validation**
- **Mongoose Schemas**: Strict types and required fields at the database level.
- **Rate Limiting**: Enforced in `triggerReview` (9-month check) to prevent spamming patients.

---

## 8. Future Migration Plan: Meta API

### **8.1. Rationale**
Migration from self-hosted Evolution API to official Meta WhatsApp Business API for increased reliability, official support, and verified business status.

### **8.2. Affected Modules**
- **[whatsappService.ts](file:///c:/Users/Administrator/Desktop/review/backend/src/services/whatsappService.ts)**: Primary change point. Replace Axios calls to Evolution API with Meta's Graph API.
- **[whatsappController.ts](file:///c:/Users/Administrator/Desktop/review/backend/src/controllers/whatsappController.ts)**: QR code logic will be removed (Meta uses phone number registration via dashboard).

### **8.3. Timeline & Mapping**
- **Phase 1**: Implement Meta API client alongside Evolution API.
- **Phase 2**: Map `instanceName` to Meta `Phone Number ID`.
- **Phase 3**: Switch default delivery provider in environment variables.
- **Breaking Change**: Meta requires pre-approved **Message Templates** for business-initiated conversations.

---
*Documentation last updated: 2026-04-04*
