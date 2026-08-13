import { Request, Response } from 'express';
import Customer from '../models/Customer';
import Business from '../models/Business';
import Patient from '../models/Patient';
import BroadcastLog from '../models/BroadcastLog';
import { queueReviewRequest } from '../services/queueService';

// @desc    Send a broadcast message (template) to multiple patients
// @route   POST /api/broadcast/send
// @access  Private
export const sendBroadcast = async (req: Request, res: Response) => {
    try {
        const { business_id, customer_ids, template_name, custom_contacts } = req.body;

        if (!business_id || !template_name) {
            return res.status(400).json({ message: 'Missing required fields (business_id, template_name)' });
        }

        const cIds = Array.isArray(customer_ids) ? customer_ids : [];
        const cContacts = Array.isArray(custom_contacts) ? custom_contacts : [];

        if (cIds.length === 0 && cContacts.length === 0) {
            return res.status(400).json({ message: 'Must provide either customer_ids or custom_contacts' });
        }

        const business = await Business.findById(business_id);
        if (!business) return res.status(404).json({ message: 'Business not found' });

        // The broadcast page lists PATIENTS (Patient model) but the queue needs to send to
        // actual phone numbers. We look them up from the Patient model directly.
        let skippedOptOut = 0;
        let customersToSend: any[] = [];

        if (cIds.length > 0) {
            const patients = await Patient.find({
                _id: { $in: cIds },
                business_id: business._id
            });

            // Filter opted-out patients (Patient schema doesn't strictly define opt_out but we check it safely)
            const activePatients = patients.filter(p => !(p as any).opt_out);
            skippedOptOut += (patients.length - activePatients.length);

            // Also check if any IDs matched customers (backward compat for customer-based broadcasts)
            if (activePatients.length === 0) {
                // Fallback: try Customer model in case the IDs came from the customer list
                const customers = await Customer.find({
                    _id: { $in: cIds },
                    business_id: business._id
                });
                const activeCustomers = customers.filter(c => !c.opt_out);
                skippedOptOut += (customers.length - activeCustomers.length);
                customersToSend = [...activeCustomers];
            } else {
                customersToSend = [...activePatients];
            }
        }

        // Process custom contacts (CSV / Manual Entry)
        for (const contact of cContacts) {
            if (!contact.name || !contact.phone) continue;
            
            let rawPhone = contact.phone.toString().trim();
            // Clean phone number
            rawPhone = rawPhone.replace(/[^\d+]/g, '');
            // If no country code (+), assume India (+91)
            if (!rawPhone.startsWith('+')) {
                // If it starts with 0, strip it just in case
                if (rawPhone.startsWith('0')) rawPhone = rawPhone.substring(1);
                
                // If the user typed 91 as the country code without the +, don't add another 91
                if (rawPhone.startsWith('91') && rawPhone.length === 12) {
                    rawPhone = '+' + rawPhone;
                } else {
                    rawPhone = '+91' + rawPhone;
                }
            }

            // Upsert into Customer model so they appear in Inbox
            const customerRecord = await Customer.findOneAndUpdate(
                { phone: rawPhone, business_id: business._id },
                {
                    $setOnInsert: {
                        name: contact.name,
                        phone: rawPhone,
                        business_id: business._id,
                        service_type: 'Broadcast Lead'
                    }
                },
                { upsert: true, new: true }
            );

            if (customerRecord && !customerRecord.opt_out) {
                customersToSend.push({
                    _id: customerRecord._id,
                    name: customerRecord.name,
                    phone: customerRecord.phone,
                    service_type: customerRecord.service_type
                });
            } else if (customerRecord?.opt_out) {
                skippedOptOut++;
            }
        }

        if (customersToSend.length === 0) {
            return res.status(200).json({
                message: 'No valid patients/contacts found to send to (all may be opted out)',
                total_selected: cIds.length + cContacts.length,
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

        // Log broadcast execution for history tracking
        try {
            await BroadcastLog.create({
                business_id: business._id,
                template_name,
                total_selected: cIds.length + cContacts.length,
                total_queued: queuedCount,
                skipped_opted_out: skippedOptOut
            });
        } catch (logErr) {
            console.warn('[BroadcastLog] Failed to log broadcast history:', logErr);
        }

        res.status(200).json({
            message: 'Broadcast queued successfully',
            total_selected: cIds.length + cContacts.length,
            skipped_opted_out: skippedOptOut,
            total_queued: queuedCount
        });

    } catch (error: any) {
        console.error("Send Broadcast Error:", error);
        res.status(500).json({ message: 'Failed to queue broadcast', error: error.message });
    }
};

// @desc    Get recent broadcast history
// @route   GET /api/broadcast/history
// @access  Private
export const getBroadcastHistory = async (req: Request, res: Response) => {
    try {
        const { business_id } = req.query;
        if (!business_id) return res.status(400).json({ error: 'Business ID required' });

        const history = await BroadcastLog.find({ business_id })
            .sort({ createdAt: -1 })
            .limit(20);

        res.status(200).json(history);
    } catch (error: any) {
        console.error('Fetch Broadcast History Error:', error);
        res.status(500).json({ error: 'Failed to fetch broadcast history' });
    }
};

