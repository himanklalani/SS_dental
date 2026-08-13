import { Request, Response } from 'express';
import Customer from '../models/Customer';
import Business from '../models/Business';
import Patient from '../models/Patient';
import { queueReviewRequest } from '../services/queueService';

// @desc    Send a broadcast message (template) to multiple patients
// @route   POST /api/broadcast/send
// @access  Private
export const sendBroadcast = async (req: Request, res: Response) => {
    try {
        const { business_id, customer_ids, template_name } = req.body;

        if (!business_id || !customer_ids || !Array.isArray(customer_ids) || !template_name) {
            return res.status(400).json({ message: 'Missing required fields or invalid customer_ids array' });
        }

        const business = await Business.findById(business_id);
        if (!business) return res.status(404).json({ message: 'Business not found' });

        // The broadcast page lists PATIENTS (Patient model) but the queue needs to send to
        // actual phone numbers. We look them up from the Patient model directly.
        const patients = await Patient.find({
            _id: { $in: customer_ids },
            business_id: business._id
        });

        // Filter opted-out patients
        const activePatients = patients.filter(p => !p.opt_out);
        const skippedOptOut = patients.length - activePatients.length;

        // Also check if any IDs matched customers (backward compat for customer-based broadcasts)
        let customersToSend: any[] = [];
        if (activePatients.length === 0) {
            // Fallback: try Customer model in case the IDs came from the customer list
            const customers = await Customer.find({
                _id: { $in: customer_ids },
                business_id: business._id
            });
            customersToSend = customers.filter(c => !c.opt_out);
        } else {
            customersToSend = activePatients;
        }

        if (customersToSend.length === 0) {
            return res.status(200).json({
                message: 'No valid patients found to send to (all may be opted out or IDs not found)',
                total_selected: customer_ids.length,
                skipped_opted_out: skippedOptOut,
                total_queued: 0
            });
        }

        let queuedCount = 0;
        for (const patient of customersToSend) {
            console.log(`[Broadcast] Queuing ${template_name} for ${patient.name} (${patient.phone})`);
            await queueReviewRequest({
                customer_id: patient._id,
                business_id: business._id,
                phone: patient.phone,
                name: patient.name,
                service_type: (patient as any).service_type || 'General',
                template_name: template_name
            } as any);
            queuedCount++;
        }

        res.status(200).json({
            message: 'Broadcast queued successfully',
            total_selected: customer_ids.length,
            skipped_opted_out: skippedOptOut,
            total_queued: queuedCount
        });

    } catch (error: any) {
        console.error("Send Broadcast Error:", error);
        res.status(500).json({ message: 'Failed to queue broadcast', error: error.message });
    }
};
