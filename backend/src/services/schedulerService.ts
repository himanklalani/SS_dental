import cron, { ScheduledTask } from 'node-cron';
import { sendWhatsAppMessage } from './whatsappService';
import Appointment from '../models/Appointment';
import Patient from '../models/Patient';
import Business from '../models/Business';

// Map to store scheduled reminder jobs: appointmentId -> reminderTask
const scheduledReminders = new Map<string, ScheduledTask>();
// Map to store scheduled review followups: appointmentId -> reviewFollowUpTask
const scheduledReviewFollowUps = new Map<string, ScheduledTask>();

export const scheduleReminders = async (appointmentId: string, appointmentDate: Date, isFollowUp: boolean = false) => {
    // Cancel existing reminder jobs if any
    cancelReminders(appointmentId);

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) return;

    const now = new Date();
    const createdAt = appointment.createdAt || new Date();
    
    // Check gap between appointment time and when it was booked
    const bookGapHours = (appointmentDate.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

    // Skip reminder if booked less than 4 hours prior to the appointment
    if (bookGapHours < 4) {
        console.log(`[Cron] Skipped reminder scheduling for ${appointmentId}: Booked within 4 hours of appointment`);
        return;
    }

    // Determine reminder offset based on appointment type
    const offsetHours = isFollowUp ? 3 : 2;
    const reminderDate = new Date(appointmentDate.getTime() - (offsetHours * 60 * 60 * 1000));

    if (reminderDate > now) {
        const cronTime = `${reminderDate.getMinutes()} ${reminderDate.getHours()} ${reminderDate.getDate()} ${reminderDate.getMonth() + 1} *`;
        const job = cron.schedule(cronTime, () => processReminder(appointmentId, isFollowUp));
        scheduledReminders.set(appointmentId, job);
        console.log(`[Cron] Scheduled ${offsetHours}h reminder for ${appointmentId} at ${reminderDate}`);
    }
};

export const cancelReminders = (appointmentId: string) => {
    const job = scheduledReminders.get(appointmentId);
    if (job) {
        job.stop();
        scheduledReminders.delete(appointmentId);
        console.log(`[Cron] Cancelled reminder for ${appointmentId}`);
    }
    cancelReviewFollowUp(appointmentId);
};

export const scheduleReviewFollowUp = (appointmentId: string) => {
    cancelReviewFollowUp(appointmentId);

    const followupDate = new Date(Date.now() + (24 * 60 * 60 * 1000));
    const cronTime = `${followupDate.getMinutes()} ${followupDate.getHours()} ${followupDate.getDate()} ${followupDate.getMonth() + 1} *`;
    
    const job = cron.schedule(cronTime, () => processReviewFollowUp(appointmentId));
    scheduledReviewFollowUps.set(appointmentId, job);
    console.log(`[Cron] Scheduled 24h review follow-up for ${appointmentId} at ${followupDate}`);
};

export const cancelReviewFollowUp = (appointmentId: string) => {
    const job = scheduledReviewFollowUps.get(appointmentId);
    if (job) {
        job.stop();
        scheduledReviewFollowUps.delete(appointmentId);
    }
};

async function processReminder(appointmentId: string, isFollowUp: boolean = false) {
    try {
        const appointment = await Appointment.findById(appointmentId)
            .populate('patient_id')
            .populate('doctor_id')
            .populate('business_id');

        if (!appointment || appointment.status === 'Cancelled' || appointment.status === 'Completed') {
            cancelReminders(appointmentId);
            return;
        }

        const patient = appointment.patient_id as any;
        const doctor = appointment.doctor_id as any;
        const business = appointment.business_id as any;

        if (!patient || !patient.phone || !appointment.appointment_date) return;

        const timeStr = new Date(appointment.appointment_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        console.log(`[Cron] Sending ${isFollowUp ? '3h follow-up' : '2h'} reminder to ${patient.phone}`);
        await sendWhatsAppMessage(
            patient.phone, 
            patient.name, 
            appointment.service_type, 
            business._id, 
            undefined, 
            isFollowUp ? 'follow_up_reminder' : 'appointment_reminder',
            undefined,
            [patient.name, appointment.service_type, timeStr]
        );

        scheduledReminders.delete(appointmentId);
    } catch (error) {
        console.error(`[Cron] Error processing reminder:`, error);
    }
}

async function processReviewFollowUp(appointmentId: string) {
    try {
        const appointment = await Appointment.findById(appointmentId)
            .populate('patient_id')
            .populate('business_id');

        if (!appointment || appointment.review_link_clicked) {
            cancelReviewFollowUp(appointmentId);
            return;
        }

        const patient = appointment.patient_id as any;
        const business = appointment.business_id as any;

        if (!patient || !patient.phone) return;

        console.log(`[Cron] Sending 24h review follow-up to ${patient.phone}`);
        await sendWhatsAppMessage(
            patient.phone, 
            patient.name, 
            appointment.service_type, 
            business._id, 
            undefined, 
            'review_follow_up',
            appointmentId,
            [patient.name, appointment.service_type]
        );

        scheduledReviewFollowUps.delete(appointmentId);
    } catch (error) {
        console.error(`[Cron] Error processing review follow-up:`, error);
    }
}
