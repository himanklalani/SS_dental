import { Request, Response } from 'express';
import Customer from '../models/Customer';
import Business from '../models/Business';
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

        // Fetch all selected customers, then filter opt-outs in JS
        // (avoids needing to ensure opt_out field exists on all records)
        const allSelected = await Customer.find({ 
            _id: { $in: customer_ids },
            business_id: business._id
        });

        const customers = allSelected.filter(c => !c.opt_out);
        const skippedOptOut = allSelected.length - customers.length;

        let queuedCount = 0;

        for (const customer of customers) {
            await queueReviewRequest({
                customer_id: customer._id,
                business_id: business._id,
                phone: customer.phone,
                name: customer.name,
                service_type: customer.service_type || 'General',
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
