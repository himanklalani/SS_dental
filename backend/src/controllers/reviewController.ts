import { Request, Response } from 'express';
import Customer from '../models/Customer';
import Patient from '../models/Patient';
import Message from '../models/Message';
import Business from '../models/Business';
import Doctor from '../models/Doctor';
import { queueReviewRequest } from '../services/queueService';
import Appointment from '../models/Appointment';
import { sendWhatsAppMessage } from '../services/whatsappService';
import axios from 'axios';

// Helper function to send instant notifications to the ntfy app
const sendNtfyNotification = async (customerName: string, messagePreview: string) => {
    try {
        const topic = process.env.NTFY_TOPIC || 'srs_dental_inbox_xyz123';
        await axios.post(`https://ntfy.sh/${topic}`, messagePreview, {
            headers: {
                'Title': `New message from ${customerName}`,
                'Priority': 'default',
                'Tags': 'speech_balloon'
            }
        });
    } catch (err) {
        console.error('[Ntfy] Failed to send notification', err);
    }
};

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
        const targetUrl = business.google_review_url || 'https://g.page/r/Cb40ziDcqQoHEAE/review';
        
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

// @desc    Send a generic pre-approved message to a patient
// @route   POST /api/send-direct
// @access  Private
export const sendDirectMessage = async (req: Request, res: Response) => {
    try {
        const { business_id, phone, name } = req.body;
        
        if (!business_id || !phone || !name) {
            return res.status(400).json({ message: 'Missing required fields: business_id, phone, name' });
        }

        const business = await Business.findById(business_id);
        if (!business) return res.status(404).json({ message: 'Business not found' });

        // Uses the pre-approved Meta template 'generic_clinic_msg'
        const response = await sendWhatsAppMessage(
            phone,
            name,
            'General',
            business._id,
            undefined,
            'generic_clinic_msg',
            undefined,
            [name]
        );

        const customer = await Customer.findOne({ phone, business_id: business._id });
        if (customer) {
             await Message.create({
                 customer_id: customer._id,
                 business_id: business._id,
                 direction: 'outbound',
                 message_type: 'template',
                 status: 'sent',
                 content: 'generic_clinic_msg',
                 whatsapp_message_id: response?.sid
             });
        }

        res.status(200).json({ message: 'Message dispatched successfully', sid: response.sid });
    } catch (error: any) {
        console.error("Send Direct Error:", error.response?.data || error);
        res.status(500).json({ message: 'Failed to dispatch message', error: error.response?.data?.error?.message || error.message });
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

    const totalSent = await Appointment.countDocuments({ business_id, review_requested: true });
    const totalClicked = await Appointment.countDocuments({ business_id, review_link_clicked: true });
    
    // We do not have a robust "conversions" tracker for Google Reviews directly, 
    // so we set it to null or remove it.
    const ctr = totalSent > 0 ? (totalClicked / totalSent) * 100 : 0;

    res.status(200).json({
        totalSent,
        totalClicked,
        clickThroughRate: ctr.toFixed(2),
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

            // Handle Incoming Messages (e.g. from patient sending STOP or Auto-Reply)
            if (value.messages && value.messages[0]) {
                const messageObj = value.messages[0];
                let From = messageObj.from; // Phone number without +
                
                // Ensure from has +91 or + if needed, Meta often sends without +. 
                // Our DB stores with +. Let's ensure format matches DB (e.g., +919004402797).
                if (!From.startsWith('+')) {
                    From = '+' + From;
                }

                const business = await Business.findOne(); // Grab first business assuming single clinic
                if (!business) return;

                // 1. Find or create customer atomically to prevent race conditions (e.g. 10 images sent at once)
                const now = new Date();
                let customer = await Customer.findOneAndUpdate(
                    { phone: From, business_id: business._id },
                    { 
                        $setOnInsert: { 
                            name: messageObj.profile?.name || 'Unknown Patient', 
                            service_type: 'General' 
                        },
                        $set: { last_interaction: now, last_message_received_at: now }
                    },
                    { upsert: true, new: false } // returns document BEFORE the update
                );

                let hoursSinceLastMessage = 999;
                
                if (!customer) {
                    // This was a brand new customer (upserted). Fetch the new document to use below.
                    customer = await Customer.findOne({ phone: From, business_id: business._id });
                    if (!customer) return; // safety catch
                } else {
                    // Customer existed. Calculate hours since their OLD last_message_received_at
                    if (customer.last_message_received_at) {
                        hoursSinceLastMessage = (now.getTime() - new Date(customer.last_message_received_at).getTime()) / (1000 * 60 * 60);
                    }
                }

                // Sync the Patient model 24-hour timestamp (if they exist there)
                await Patient.updateMany({ phone: From }, { last_message_received_at: now });
                console.log(`[Webhook] Opened 24h window for ${From}. Hours since last message: ${hoursSinceLastMessage.toFixed(2)}`);

                // Spawn 23h 45m memory timer for window closure warning
                const timeoutMs = 23.75 * 60 * 60 * 1000; // 23h 45m
                setTimeout(async () => {
                    try {
                        const p = await Patient.findOne({ phone: From });
                        if (p && p.last_message_received_at) {
                            const hours = (Date.now() - new Date(p.last_message_received_at).getTime()) / (1000 * 60 * 60);
                            // If they haven't sent another message (meaning it's exactly ~23.75h since the message that spawned this timer)
                            if (hours >= 23.74 && hours < 24) {
                                console.log(`[Webhook Timer] 24h window closing for ${From}, sending warning.`);
                                const response = await sendWhatsAppMessage(
                                    From,
                                    customer.name,
                                    'General',
                                    business._id,
                                    'Thanks for reaching out! Hope you were satisfied with the answer. If there is any need, please leave a message which will allow us to reach you back ASAP.'
                                );
                                await Message.create({
                                    customer_id: customer._id,
                                    business_id: business._id,
                                    direction: 'outbound',
                                    message_type: 'text',
                                    status: 'sent',
                                    content: 'Thanks for reaching out! Hope you were satisfied with the answer. If there is any need, please leave a message which will allow us to reach you back ASAP.',
                                    whatsapp_message_id: response?.sid
                                });
                            }
                        }
                    } catch (err) {
                        console.error("[Webhook Timer Error]", err);
                    }
                }, timeoutMs);

                // Send Auto-Reply if it's their first message or > 48 hours since their last message
                // Note: We check this before the STOP command logic. If they said STOP, they'll opt out anyway.
                // But typically STOP shouldn't trigger an auto reply, so let's check it.
                let isStopCommand = false;
                if (messageObj.type === 'text' && messageObj.text?.body?.trim().toUpperCase() === 'STOP') {
                    isStopCommand = true;
                }

                if (hoursSinceLastMessage > 48 && !isStopCommand) {
                    try {
                        const response = await sendWhatsAppMessage(
                            From, 
                            customer.name, 
                            'General', 
                            business._id, 
                            undefined, 
                            'auto_reply_hello'
                        );

                        await Message.create({
                            customer_id: customer._id,
                            business_id: business._id,
                            direction: 'outbound',
                            message_type: 'template',
                            status: 'sent',
                            content: 'auto_reply_hello',
                            whatsapp_message_id: response?.sid
                        });
                    } catch (e) {
                        console.error('[Webhook] Failed to send auto reply', e);
                    }
                }
                // 3. Handle Text Messages & Auto-replies
                if (messageObj.type === 'text' && messageObj.text?.body) {
                    const Body = messageObj.text.body;
                    
                    if (Body.trim().toUpperCase() === 'STOP') {
                        // Opt-out customer
                        customer.opt_out = true;
                        await customer.save();
                        console.log(`[Webhook] Customer ${From} opted out via STOP command`);
                    } else {
                        console.log(`[Webhook] Received message from ${From}: ${Body}`);
                        
                        await Message.create({
                            customer_id: customer._id,
                            business_id: business._id,
                            direction: 'inbound',
                            message_type: 'text',
                            status: 'received',
                            content: Body,
                            whatsapp_message_id: messageObj.id,
                            context_message_id: messageObj.context?.id
                        });
                        
                        // Send notification
                        sendNtfyNotification(customer.name, Body);
                    }
                } 
                // 4. Handle Incoming Media (Images, Documents, Audio)
                else if (['image', 'document', 'audio', 'video'].includes(messageObj.type)) {
                    const mediaObj = messageObj[messageObj.type];
                    const mediaId = mediaObj?.id;
                    const caption = mediaObj?.caption || '';
                    const filename = mediaObj?.filename || ''; // Meta sends filename for documents

                    if (mediaId) {
                        console.log(`[Webhook] Received media from ${From}: ${mediaId}`);
                        const contentStr = caption || filename || `Received a ${messageObj.type}`;
                        await Message.create({
                            customer_id: customer._id,
                            business_id: business._id,
                            direction: 'inbound',
                            message_type: messageObj.type,
                            status: 'received',
                            content: contentStr,
                            media_id: mediaId,
                            whatsapp_message_id: messageObj.id,
                            context_message_id: messageObj.context?.id
                        });

                        // Send notification
                        sendNtfyNotification(customer.name, contentStr);
                    }
                }
                // 5. Handle Button Clicks (Quick Replies)
                else if (messageObj.type === 'button') {
                    const buttonText = messageObj.button?.text;
                    console.log(`[Webhook] User ${From} clicked button: ${buttonText}`);
                    
                    const contentStr = buttonText || 'Button clicked';
                    await Message.create({
                        customer_id: customer._id,
                        business_id: business._id,
                        direction: 'inbound',
                        message_type: 'button',
                        status: 'received',
                        content: contentStr,
                        whatsapp_message_id: messageObj.id,
                        context_message_id: messageObj.context?.id
                    });

                    // Send notification
                    sendNtfyNotification(customer.name, contentStr);
                }
                else if (messageObj.type === 'interactive') {
                    const buttonReply = messageObj.interactive?.button_reply?.title;
                    console.log(`[Webhook] User ${From} clicked interactive button: ${buttonReply}`);
                    
                    const contentStr = buttonReply || 'Interactive button clicked';
                    await Message.create({
                        customer_id: customer._id,
                        business_id: business._id,
                        direction: 'inbound',
                        message_type: 'interactive',
                        status: 'received',
                        content: contentStr,
                        whatsapp_message_id: messageObj.id,
                        context_message_id: messageObj.context?.id
                    });

                    // Send notification
                    sendNtfyNotification(customer.name, contentStr);
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
