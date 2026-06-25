import express from 'express';
import { triggerReview, getAnalytics, webhook, verifyWebhook, scheduleReview, getBusiness, updateBusiness, trackReviewClick, sendDirectMessage } from '../controllers/reviewController';
import { getPatients, createPatient, updatePatient, getPatient, deletePatient } from '../controllers/patientController';
import { getAppointments, createAppointment, updateAppointment, deleteAppointment, createPublicBooking } from '../controllers/appointmentController';
import Doctor from '../models/Doctor';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// Healthcheck Endpoint
router.get('/health', (req, res) => {
    const dbState = mongoose.connection.readyState;
    const dbStatus = dbState === 1 ? 'connected' : dbState === 2 ? 'connecting' : 'disconnected';
    const whatsappStatus = process.env.META_API_TOKEN && process.env.META_PHONE_NUMBER_ID ? 'configured' : 'missing_config';
    
    res.status(dbState === 1 ? 200 : 503).json({
        status: dbState === 1 ? 'online' : 'degraded',
        database: dbStatus,
        whatsapp: whatsappStatus,
        timestamp: new Date().toISOString()
    });
});

// Tracking Endpoint
router.get('/r/:appointmentId', trackReviewClick);

// Reviews & Business
router.post('/send-direct', sendDirectMessage);
router.post('/trigger-review', triggerReview);
router.post('/schedule', scheduleReview);
router.get('/analytics', getAnalytics);
router.get('/webhook', verifyWebhook);
router.post('/webhook', webhook);
router.get('/business/:id', getBusiness);
router.put('/business/:id', updateBusiness);
router.get('/r/:appointmentId', trackReviewClick); // <-- Added the missing tracking route

// Chat & Inbox
import { getChats, getChatHistory, getMediaUrl, sendManualReply, sendMediaReply, updateCustomerName, deleteChatHistory, deleteContact, reactToMessage } from '../controllers/chatController';
import multer from 'multer';
const upload = multer({ storage: multer.memoryStorage() });

router.get('/chats', getChats);
router.get('/chats/media/:mediaId', getMediaUrl);       // ← MUST be before /:customerId
router.post('/chats/reply', sendManualReply);            // ← MUST be before /:customerId
router.post('/chats/react', reactToMessage);             // ← MUST be before /:customerId
router.post('/chats/media-reply', upload.single('file'), sendMediaReply); // ← MUST be before /:customerId
router.get('/chats/:customerId', getChatHistory);
router.delete('/chats/:customerId', deleteChatHistory);
router.delete('/chats/:customerId/contact', deleteContact);
router.put('/chats/:customerId/name', updateCustomerName);

// Broadcasts
import { sendBroadcast } from '../controllers/broadcastController';
router.post('/broadcast/send', sendBroadcast);

// CRM - Patients
router.get('/patients', getPatients);
router.post('/patients', createPatient);
router.put('/patients/:id', updatePatient);
router.delete('/patients/:id', deletePatient);
router.get('/patients/:id', getPatient);

// CRM - Appointments
router.get('/appointments', getAppointments);
router.post('/appointments', createAppointment);
router.put('/appointments/:id', updateAppointment);
router.delete('/appointments/:id', deleteAppointment);

// Public Booking Limiter: Max 5 requests per hour
const publicBookingLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // limit each IP to 5 requests per windowMs
    message: { error: 'Too many booking requests from this IP, please try again after an hour' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Public Booking
router.post('/public/book', publicBookingLimiter, createPublicBooking);

// CRM - Doctors (Simple CRUD for now)
router.get('/doctors', async (req, res) => {
    try {
        const doctors = await Doctor.find({ business_id: req.query.business_id });
        res.json(doctors);
    } catch (e) { res.status(500).json({ error: 'Failed' }); }
});
router.post('/doctors', async (req, res) => {
    try {
        const doctor = new Doctor(req.body);
        await doctor.save();
        res.status(201).json(doctor);
    } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

export default router;
