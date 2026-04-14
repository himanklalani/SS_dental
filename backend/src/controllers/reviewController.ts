import { Request, Response } from 'express';
import Customer from '../models/Customer';
import Message from '../models/Message';
import Business from '../models/Business';
import Doctor from '../models/Doctor';
import { queueReviewRequest } from '../services/queueService';
import Appointment from '../models/Appointment';

// @desc    Track review link click and redirect
// @route   GET /api/r/:appointmentId
// @access  Public
export const trackReviewClick = async (req: Request, res: Response) => {
    try {
        const appointmentId = req.params.appointmentId;
        const appointment = await Appointment.findById(appointmentId).populate('business_id');
        
        if (!appointment) {
            return res.status(404).send('Not Found');
        }

        // Mark as clicked
        appointment.review_link_clicked = true;
        appointment.review_link_clicked_at = new Date();
        await appointment.save();

        const business = appointment.business_id as any;
        const targetUrl = business.google_review_url || 'https://google.com';
        
        // Redirect the user
        res.redirect(targetUrl);
    } catch (error) {
        console.error('Review Track Error:', error);
        res.status(500).send('Internal Server Error');
    }
};

// @desc    Trigger a review request
// @route   POST /api/trigger-review
// @access  Private (API Key required)
export const triggerReview = async (req: Request, res: Response) => {
  try {
    const { name, phone, service_type, business_id } = req.body;

    // Validate input
    if (!name || !phone || !service_type || !business_id) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Check if business exists
    const business = await Business.findById(business_id);
    if (!business) {
      return res.status(404).json({ message: 'Business not found' });
    }

    // Check for existing customer
    let customer = await Customer.findOne({ phone, business_id });

    // Rate Limiting: Check for last message sent to this customer for this business
    // Max 1 review request per customer per 30 days per business
    if (customer) {
        if (customer.opt_out) {
            return res.status(400).json({ message: 'Customer has opted out' });
        }

        const nineMonthsAgo = new Date();
        nineMonthsAgo.setMonth(nineMonthsAgo.getMonth() - 9);

        const recentMessage = await Message.findOne({
            customer_id: customer._id,
            business_id: business._id,
            createdAt: { $gt: nineMonthsAgo },
            status: { $in: ['queued', 'sent', 'delivered', 'clicked', 'completed'] }
        });

        if (recentMessage) {
            return res.status(429).json({ 
                message: 'Rate limit exceeded: Review request already sent in the last 9 months',
                last_sent: recentMessage.createdAt 
            });
        }
        
        // Update service type and interaction time
        customer.service_type = service_type;
        customer.last_interaction = new Date();
        await customer.save();
    } else {
      customer = await Customer.create({
        name,
        phone,
        service_type,
        business_id
      });
    }

    // Calculate Schedule Time (Immediate Trigger requested, but still within 9 AM - 8 PM compliance if desired)
    // To make it TRULY immediate as requested "as soon as clicked", we'll use delay = 0.
    const delay = 0; 
    
    // Add to queue
    await queueReviewRequest({
      customer_id: customer._id,
      business_id: business._id,
      phone: customer.phone,
      name: customer.name,
      service_type: customer.service_type
    }, delay);

    res.status(200).json({ message: 'Review request triggered successfully', customer_id: customer._id });

  } catch (error: any) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Schedule a review request
// @route   POST /api/schedule
// @access  Private
export const scheduleReview = async (req: Request, res: Response) => {
    // Similar to trigger but with explicit schedule time
    try {
        const { name, phone, service_type, business_id, schedule_time } = req.body;

        if (!name || !phone || !service_type || !business_id || !schedule_time) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        const business = await Business.findById(business_id);
        if (!business) {
            return res.status(404).json({ message: 'Business not found' });
        }

        let customer = await Customer.findOne({ phone, business_id });
        if (!customer) {
            customer = await Customer.create({
                name,
                phone,
                service_type,
                business_id
            });
        }

        const scheduleDate = new Date(schedule_time);
        const delay = scheduleDate.getTime() - Date.now();

        if (delay < 0) {
             return res.status(400).json({ message: 'Schedule time must be in the future' });
        }

        await queueReviewRequest({
            customer_id: customer._id,
            business_id: business._id,
            phone: customer.phone,
            name: customer.name,
            service_type: customer.service_type
        }, delay);

        res.status(200).json({ message: 'Review request scheduled', customer_id: customer._id });

    } catch (error: any) {
        console.error(error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
}

import mongoose from 'mongoose';

// @desc    Get analytics
// @route   GET /api/analytics
// @access  Private
export const getAnalytics = async (req: Request, res: Response) => {
  try {
    const { business_id } = req.query;

    if (!business_id) {
        return res.status(200).json({
            totalSent: 0,
            totalClicked: 0,
            totalCompleted: 0,
            totalQueued: 0,
            totalFailed: 0,
            clickThroughRate: "0.00",
            completionRate: "0.00"
        });
    }

    if (!mongoose.Types.ObjectId.isValid(business_id as string)) {
        return res.status(400).json({ message: 'Invalid Business ID format' });
    }

    const totalSent = await Message.countDocuments({ business_id, status: { $in: ['sent', 'delivered', 'clicked', 'completed'] } });
    const totalClicked = await Message.countDocuments({ business_id, status: { $in: ['clicked', 'completed'] } });
    const totalCompleted = await Message.countDocuments({ business_id, status: 'completed' });
    const totalQueued = await Message.countDocuments({ business_id, status: 'queued' });
    const totalFailed = await Message.countDocuments({ business_id, status: 'failed' });

    const ctr = totalSent > 0 ? (totalClicked / totalSent) * 100 : 0;
    const completionRate = totalClicked > 0 ? (totalCompleted / totalClicked) * 100 : 0;

    res.status(200).json({
        totalSent,
        totalClicked,
        totalCompleted,
        totalQueued,
        totalFailed,
        clickThroughRate: ctr.toFixed(2),
        completionRate: completionRate.toFixed(2)
    });

  } catch (error: any) {
    console.error("Analytics Error:", error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Verify Meta Webhook setup
// @route   GET /api/webhook
// @access  Public
export const verifyWebhook = (req: Request, res: Response) => {
    const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN || 'voice_diary_123';
    
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('WEBHOOK_VERIFIED');
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    } else {
        res.sendStatus(400);
    }
};

// @desc    Webhook for WhatsApp status updates & incoming messages
// @route   POST /api/webhook
// @access  Public
export const webhook = async (req: Request, res: Response) => {
    try {
        const { object, entry } = req.body;

        if (object === 'whatsapp_business_account' && entry && entry[0]?.changes && entry[0].changes[0]?.value) {
            const value = entry[0].changes[0].value;

            // Handle Status Updates (sent, delivered, read, failed)
            if (value.statuses && value.statuses[0]) {
                const statusObj = value.statuses[0];
                const MessageSid = statusObj.id; // wamid.XYZ
                const MessageStatus = statusObj.status;
                
                if (MessageSid && MessageStatus) {
                    await Message.findOneAndUpdate(
                        { whatsapp_message_id: MessageSid },
                        { status: MessageStatus }
                    );
                    console.log(`[Webhook] Message ${MessageSid} status updated to ${MessageStatus}`);
                }
            }

            // Handle Incoming Messages (e.g. from patient sending STOP)
            if (value.messages && value.messages[0]) {
                const messageObj = value.messages[0];
                const From = messageObj.from; // Phone number without +

                if (messageObj.type === 'text' && messageObj.text?.body) {
                    const Body = messageObj.text.body;
                    
                    if (Body.trim().toUpperCase() === 'STOP') {
                        // Opt-out customer
                        await Customer.updateMany({ phone: From }, { opt_out: true });
                        console.log(`[Webhook] Customer ${From} opted out via STOP command`);
                    } else {
                        // Future implementation for bot replies could go here
                        console.log(`[Webhook] Received message from ${From}: ${Body}`);
                    }
                }
            }
        }

        res.status(200).send('EVENT_RECEIVED');
    } catch (error) {
        console.error('[Webhook] Error processing payload:', error);
        res.status(500).send('ERROR');
    }
};

// @desc    Get business settings
// @route   GET /api/business/:id
// @access  Private
export const getBusiness = async (req: Request, res: Response) => {
    try {
        const business = await Business.findById(req.params.id);
        if (!business) {
            return res.status(404).json({ message: 'Business not found' });
        }
        res.status(200).json(business);
    } catch (error: any) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Update business settings
// @route   PUT /api/business/:id
// @access  Private
export const updateBusiness = async (req: Request, res: Response) => {
    try {
        const business = await Business.findById(req.params.id);
        if (!business) {
            return res.status(404).json({ message: 'Business not found' });
        }

        const { message_templates, google_review_url } = req.body;

        if (message_templates) business.message_templates = message_templates;
        if (google_review_url) business.google_review_url = google_review_url;

        await business.save();
        res.status(200).json(business);
    } catch (error: any) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};
