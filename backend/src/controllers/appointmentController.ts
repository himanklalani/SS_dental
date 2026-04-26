import { Request, Response } from 'express';
import Appointment from '../models/Appointment';
import Patient from '../models/Patient';
import Customer from '../models/Customer';
import Doctor from '../models/Doctor';
import Business from '../models/Business';
import { scheduleReminders, cancelReminders, scheduleReviewFollowUp } from '../services/schedulerService';
import { sendWhatsAppMessage } from '../services/whatsappService';

const checkDoubleBooking = async (business_id: string, appointment_date: Date, excludeId?: string) => {
    const query: any = {
        business_id,
        appointment_date,
        status: { $in: ['Booked', 'Confirmed', 'Completed'] }
    };
    if (excludeId) query._id = { $ne: excludeId };
    return await Appointment.exists(query);
};

const getDefaultDoctor = async (business_id: string) => {
    let doctor = await Doctor.findOne({ business_id });
    if (!doctor) {
        doctor = await Doctor.create({ business_id, name: 'Default Doctor', specialization: 'General Dentistry', phone: '0000000000' });
    }
    return doctor;
};

// Get appointments (with filtering, searching, pagination)
export const getAppointments = async (req: Request, res: Response) => {
    try {
        const { business_id, date, status, patient_id, search, preferred_slot } = req.query;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 50;

        if (!business_id) return res.status(400).json({ error: 'Business ID required' });

        const query: any = { business_id };
        
        if (date) {
            const startOfDay = new Date(date as string);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(date as string);
            endOfDay.setHours(23, 59, 59, 999);
            
            // Allow appointments matching the current date OR recently requested appointments without exact dates
            // Wait, requested appointments might just have date and no time. We filter by day matching.
            query.$or = [
                { appointment_date: { $gte: startOfDay, $lte: endOfDay } },
                { status: 'Requested', createdAt: { $gte: startOfDay, $lte: endOfDay } } // rough fallback or just rely on the stored date
            ];
            // Fix: Actually we are storing appointment_date for Requested slots too
            delete query.$or;
            query.appointment_date = { $gte: startOfDay, $lte: endOfDay };
        }
        
        if (status) query.status = status;
        if (patient_id) query.patient_id = patient_id;
        if (preferred_slot) query.preferred_slot = preferred_slot;

        if (search) {
            const matchedPatients = await Patient.find({
                business_id,
                $or: [
                    { name: new RegExp(search as string, 'i') },
                    { phone: new RegExp(search as string, 'i') }
                ]
            }).select('_id');
            query.patient_id = { $in: matchedPatients.map(p => p._id) };
        }

        const skip = (page - 1) * limit;

        const appointments = await Appointment.find(query)
            .populate('patient_id', 'name phone email')
            .populate('doctor_id', 'name specialization')
            .sort({ appointment_date: -1, createdAt: -1 })
            .skip(skip)
            .limit(limit);
            
        const total = await Appointment.countDocuments(query);

        res.status(200).json({
            data: appointments,
            total,
            page,
            totalPages: Math.ceil(total / limit)
        });
    } catch (error) {
        console.error('Fetch Appointments Error:', error);
        res.status(500).json({ error: 'Failed to fetch appointments' });
    }
};

export const createAppointment = async (req: Request, res: Response) => {
    try {
        const appointmentData = { ...req.body };
        
        if (!appointmentData.doctor_id) {
            const doctor = await getDefaultDoctor(appointmentData.business_id);
            appointmentData.doctor_id = doctor._id;
        }

        if (appointmentData.appointment_date && ['Booked', 'Confirmed', 'Completed'].includes(appointmentData.status)) {
            const isDoubleBooked = await checkDoubleBooking(appointmentData.business_id, new Date(appointmentData.appointment_date));
            if (isDoubleBooked) {
                return res.status(400).json({ error: 'Time slot is already double booked.' });
            }
        }

        const appointment = new Appointment(appointmentData);
        await appointment.save();

        if (['Booked', 'Confirmed'].includes(appointment.status) && appointment.appointment_date) {
            const patient = await Patient.findById(appointment.patient_id);
            const doctor = await Doctor.findById(appointment.doctor_id);
            const business = await Business.findById(appointment.business_id);

            if (patient && doctor && business) {
                try {
                    const tDate = new Date(appointment.appointment_date).toLocaleDateString();
                    const tTime = new Date(appointment.appointment_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    
                    await sendWhatsAppMessage(
                        patient.phone, 
                        patient.name, 
                        appointment.service_type, 
                        business._id, 
                        undefined, 
                        'booking_confirmation',
                        undefined,
                        [patient.name, tDate, tTime, appointment.service_type]
                    );
                } catch (msgError) {
                    console.error(`[CRM] Failed to send booking confirmation:`, msgError);
                }
            }
            await scheduleReminders(appointment._id.toString(), appointment.appointment_date);
        }

        res.status(201).json(appointment);
    } catch (error) {
        console.error('Create Appointment Error:', error);
        res.status(500).json({ error: 'Failed to create appointment', details: error });
    }
};

export const deleteAppointment = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        await cancelReminders(id);
        await Appointment.findByIdAndDelete(id);
        res.status(200).json({ message: 'Appointment deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete appointment' });
    }
};

export const updateAppointment = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const oldAppointment = await Appointment.findById(id);
        if (!oldAppointment) return res.status(404).json({ error: 'Appointment not found' });

        const newStatus = req.body.status || oldAppointment.status;
        const newDate = req.body.appointment_date ? new Date(req.body.appointment_date) : oldAppointment.appointment_date;

        if (['Booked', 'Confirmed', 'Completed'].includes(newStatus) && newDate) {
             const isDoubleBooked = await checkDoubleBooking(oldAppointment.business_id.toString(), newDate, id);
             if (isDoubleBooked) {
                 return res.status(400).json({ error: 'Time slot is already double booked.' });
             }
        }

        if (!req.body.doctor_id && !oldAppointment.doctor_id) {
             const doctor = await getDefaultDoctor(oldAppointment.business_id.toString());
             req.body.doctor_id = doctor._id;
        }

        const updatedAppointment = await Appointment.findByIdAndUpdate(id, req.body, { new: true });
        if (!updatedAppointment) return res.status(404).json({ error: 'Error updating' });

        const business = await Business.findById(updatedAppointment.business_id);

        if (req.body.status === 'Cancelled' && oldAppointment.status !== 'Cancelled') {
            await cancelReminders(id);
            const patient = await Patient.findById(oldAppointment.patient_id);
            if (patient && patient.phone && business) {
                try {
                    await sendWhatsAppMessage(patient.phone, patient.name, oldAppointment.service_type, business._id, undefined, 'appointment_cancelled', undefined, [patient.name, oldAppointment.service_type]);
                } catch (err) { console.error('Failed to send cancel message', err); }
            }
        }

        if (newDate && newDate.getTime() !== oldAppointment.appointment_date?.getTime()) {
             // Rescheduled logic: reset reminders
             if (['Booked', 'Confirmed'].includes(updatedAppointment.status)) {
                 await scheduleReminders(id, newDate);
                 const patient = await Patient.findById(updatedAppointment.patient_id);
                 if (patient && patient.phone && business) {
                     try {
                         const tDate = new Date(newDate).toLocaleDateString();
                         const tTime = new Date(newDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                         await sendWhatsAppMessage(patient.phone, patient.name, updatedAppointment.service_type, business._id, undefined, 'appointment_rescheduled', undefined, [patient.name, tDate, tTime, updatedAppointment.service_type]);
                     } catch (err) { console.error('Failed to send reschedule message', err); }
                 }
             }
        }

        if (req.body.status === 'Completed' && oldAppointment.status !== 'Completed' && !updatedAppointment.review_requested) {
            const patient = await Patient.findById(updatedAppointment.patient_id);
            if (patient && patient.phone && business) {
                const messageType = req.body.message_type || 'none';

                if (messageType === 'thank_you') {
                    // Send basic thank you template (or text fallback)
                    await sendWhatsAppMessage(
                        patient.phone, 
                        patient.name, 
                        updatedAppointment.service_type, 
                        business._id, 
                        undefined, 
                        'thank_you_simple',
                        undefined,
                        [patient.name, updatedAppointment.service_type]
                    );
                } else if (messageType === 'review') {
                    try {
                        // Send Review Request Template with Button
                        await sendWhatsAppMessage(
                            patient.phone, 
                            patient.name, 
                            updatedAppointment.service_type, 
                            business._id, 
                            undefined, 
                            'review_request',
                            updatedAppointment._id.toString(),
                            [patient.name, updatedAppointment.service_type]
                        );

                        // Schedule the link unopened tracker
                        scheduleReviewFollowUp(updatedAppointment._id.toString());

                        updatedAppointment.review_requested = true;
                        updatedAppointment.review_requested_at = new Date();
                        await updatedAppointment.save();
                    } catch (queueError) {
                        console.error(`[CRM] Failed to send review request:`, queueError);
                    }
                }
            }
        }

        res.status(200).json(updatedAppointment);
    } catch (error) {
        console.error('Update Appointment Error:', error);
        res.status(500).json({ error: 'Failed to update appointment' });
    }
};

export const createPublicBooking = async (req: Request, res: Response) => {
    try {
        const { name, phone, email, date, service_type, preferred_slot, business_id, notes, api_key } = req.body;
        
        if (!business_id || !name || !phone || !date || !preferred_slot || !service_type || !api_key) {
             return res.status(400).json({ error: 'Missing required fields' });
        }

        // ── 1. Normalize Inputs ──────────────────────────────────────────────────
        // Name → lowercase, trimmed (stored consistently regardless of what user typed)
        const normalizedName = name.trim().toLowerCase();
        // Phone → strip everything except digits and leading +
        const normalizedPhone = phone.trim().replace(/[^\d+]/g, '');

        // ── 2. Validate Business and API Key ─────────────────────────────────────
        const business = await Business.findOne({ _id: business_id, api_key });
        if (!business) {
            return res.status(401).json({ error: 'Unauthorized: Invalid Business ID or API Key' });
        }

        // ── 3. Patient Lookup Strategy ───────────────────────────────────────────
        // Rule: ONLY reuse an existing patient if BOTH name AND phone match exactly.
        // Case A: same name, different number  → create new patient
        // Case B: same number, different name  → create new patient
        // Case C: both match                   → reuse existing patient
        // Case D: completely new               → create new patient
        let patient = await Patient.findOne({
            business_id,
            name: normalizedName,
            phone: normalizedPhone
        });

        if (!patient) {
            patient = new Patient({
                business_id,
                name: normalizedName,
                phone: normalizedPhone,
                email: email ? email.trim().toLowerCase() : undefined,
                preferred_contact: 'WhatsApp',
                status: 'New'
            });
            await patient.save();
        }

        // ── 4. Create Appointment ────────────────────────────────────────────────
        const doctor = await getDefaultDoctor(business_id);

        const appointment = new Appointment({
            business_id,
            patient_id: patient._id,
            doctor_id: doctor._id,
            appointment_date: new Date(date),
            service_type: service_type.trim().toLowerCase(),
            status: 'Requested',
            preferred_slot,
            notes: notes ? notes.trim() : undefined,
            duration_minutes: 15
        });

        await appointment.save();

        res.status(201).json({ 
            appointment,
            patient: { id: patient._id, isNew: !patient.createdAt || (Date.now() - patient.createdAt.getTime()) < 5000 }
        });
    } catch (error) {
        console.error('Public Booking Error:', error);
        res.status(500).json({ error: 'Failed to submit booking request' });
    }
};

