import cron, { ScheduledTask } from 'node-cron';
import { sendWhatsAppMessage } from './whatsappService';
import Appointment from '../models/Appointment';
import Patient from '../models/Patient';
import Business from '../models/Business';

// Map to store scheduled reminder jobs: appointmentId -> reminderTask
const scheduledReminders = new Map<string, ScheduledTask>();
// Map to store scheduled review followups: appointmentId -> reviewFollowUpTask
const scheduledReviewFollowUps = new Map<string, ScheduledTask>();

export const scheduleReminders = async (appointmentId: string, appointmentDate: Date) => {
    // Cancel existing reminder jobs if any
    cancelReminders(appointmentId);

    const now = new Date();
    const timeDiffHours = (appointmentDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    // If appointment is less than 3 hours away, skip scheduling the reminder
    if (timeDiffHours < 3) {
        return;
    }

    // Schedule 2h Reminder
    const reminderDate = new Date(appointmentDate.getTime() - (2 * 60 * 60 * 1000));
    if (reminderDate > now) {
        const cronTime = `${reminderDate.getMinutes()} ${reminderDate.getHours()} ${reminderDate.getDate()} ${reminderDate.getMonth() + 1} *`;
        const job = cron.schedule(cronTime, () => processReminder(appointmentId));
        scheduledReminders.set(appointmentId, job);
        console.log(`[Cron] Scheduled 2h reminder for ${appointmentId} at ${reminderDate}`);
    }
};

export const cancelReminders = (appointmentId: string) => {
    const job = scheduledReminders.get(appointmentId);
    if (job) {
        job.stop();
        scheduledReminders.delete(appointmentId);
        console.log(`[Cron] Cancelled reminder for ${appointmentId}`);
    }
    // Also cancel any pending review follow-ups if rescheduled before completion
    cancelReviewFollowUp(appointmentId);
};

export const scheduleReviewFollowUp = (appointmentId: string) => {
    cancelReviewFollowUp(appointmentId);

    // Schedule for 24 hours from now
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

async function processReminder(appointmentId: string) {
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
        
        console.log(`[Cron] Sending 2h reminder to ${patient.phone}`);
        await sendWhatsAppMessage(
            patient.phone, 
            patient.name, 
            appointment.service_type, 
            business._id, 
            undefined, 
            'appointment_reminder'
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
            appointmentId
        );

        scheduledReviewFollowUps.delete(appointmentId);
    } catch (error) {
        console.error(`[Cron] Error processing review follow-up:`, error);
    }
}
