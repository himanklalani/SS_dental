import { Request, Response } from 'express';
import mongoose from 'mongoose';
import axios from 'axios';
import Customer from '../models/Customer';
import Patient from '../models/Patient';
import Message from '../models/Message';
import Business from '../models/Business';
import { sendWhatsAppMessage, sendWhatsAppMedia } from '../services/whatsappService';

// @desc    Get list of active chats (patients who have messaged or been messaged)
// @route   GET /api/chats
// @access  Private
export const getChats = async (req: Request, res: Response) => {
    try {
        const { business_id } = req.query;
        if (!business_id) return res.status(400).json({ message: 'Missing business_id' });

        // Aggregate to find the latest message per customer
        const latestMessages = await Message.aggregate([
            { $match: { business_id: new mongoose.Types.ObjectId(business_id as string) } },
            { $sort: { createdAt: -1 } },
            {
                $group: {
                    _id: "$customer_id",
                    latestMessage: { $first: "$$ROOT" }
                }
            }
        ]);

        const customerIds = latestMessages.map(m => m._id);
        const customers = await Customer.find({ _id: { $in: customerIds } }).lean();

        // Combine customer data with their latest message
        const chats = customers.map(customer => {
            const latestMsg = latestMessages.find(m => m._id.toString() === customer._id.toString());
            return {
                ...customer,
                latestMessage: latestMsg ? latestMsg.latestMessage : null
            };
        });

        // Sort chats by latest message timestamp descending
        chats.sort((a, b) => {
            const timeA = a.latestMessage ? new Date(a.latestMessage.createdAt).getTime() : 0;
            const timeB = b.latestMessage ? new Date(b.latestMessage.createdAt).getTime() : 0;
            return timeB - timeA;
        });

        res.status(200).json(chats);
    } catch (error: any) {
        console.error("Get Chats Error:", error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Get chat history for a specific customer
// @route   GET /api/chats/:customerId
// @access  Private
export const getChatHistory = async (req: Request, res: Response) => {
    try {
        const { customerId } = req.params;
        const messages = await Message.find({ customer_id: customerId }).sort({ createdAt: 1 });
        res.status(200).json(messages);
    } catch (error: any) {
        console.error("Get Chat History Error:", error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Delete chat history for a specific customer
// @route   DELETE /api/chats/:customerId
// @access  Private
export const deleteChatHistory = async (req: Request, res: Response) => {
    try {
        const { customerId } = req.params;
        await Message.deleteMany({ customer_id: customerId });
        res.status(200).json({ message: 'Chat history deleted successfully' });
    } catch (error: any) {
        console.error("Delete Chat History Error:", error);
        res.status(500).json({ message: 'Failed to delete chat history', error: error.message });
    }
};

// @desc    Update customer name
// @route   PUT /api/chats/:customerId/name
// @access  Private
export const updateCustomerName = async (req: Request, res: Response) => {
    try {
        const { customerId } = req.params;
        const { name } = req.body;
        if (!name) return res.status(400).json({ message: 'Name is required' });

        const customer = await Customer.findByIdAndUpdate(customerId, { name }, { new: true });
        res.status(200).json(customer);
    } catch (error: any) {
        console.error("Update Customer Name Error:", error);
        res.status(500).json({ message: 'Failed to update name', error: error.message });
    }
};

// @desc    Send a manual text reply to a customer
// @route   POST /api/chats/reply
// @access  Private
export const sendManualReply = async (req: Request, res: Response) => {
    try {
        const { business_id, customer_id, text } = req.body;

        if (!business_id || !customer_id || !text) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        const customer = await Customer.findById(customer_id);
        if (!customer) return res.status(404).json({ message: 'Customer not found' });

        // Ensure we are within the 24-hour window
        let windowIsOpen = false;
        const dbPhone = customer.phone.startsWith('+') ? customer.phone : '+' + customer.phone.replace(/[^0-9]/g, '');
        const patient = await Patient.findOne({ phone: dbPhone });
        
        const lastMessageTime = patient?.last_message_received_at || customer.last_interaction;
        if (lastMessageTime) {
            const hoursSinceLastMessage = (Date.now() - new Date(lastMessageTime).getTime()) / (1000 * 60 * 60);
            if (hoursSinceLastMessage < 24) {
                windowIsOpen = true;
            }
        }

        if (!windowIsOpen) {
            return res.status(400).json({ 
                message: '24-hour service window has closed. You can only send pre-approved templates.',
                windowClosed: true 
            });
        }

        // Send via WhatsApp Service
        const response = await sendWhatsAppMessage(
            customer.phone,
            customer.name,
            'General',
            business_id,
            text
        );

        // Save as outbound message
        const message = await Message.create({
            customer_id: customer._id,
            business_id: business_id,
            direction: 'outbound',
            message_type: 'text',
            status: 'sent',
            content: text,
            whatsapp_message_id: response?.sid
        });

        res.status(200).json({ message: 'Reply sent', data: message });
    } catch (error: any) {
        console.error("Send Manual Reply Error:", error.response?.data || error);
        res.status(500).json({ message: 'Failed to send reply', error: error.response?.data?.error?.message || error.message });
    }
};

// @desc    Securely fetch media URL from Meta using media_id
// @route   GET /api/chats/media/:mediaId
// @access  Private
export const getMediaUrl = async (req: Request, res: Response) => {
    try {
        const { mediaId } = req.params;
        const META_API_TOKEN = process.env.META_API_TOKEN;

        if (!META_API_TOKEN) {
            return res.status(500).json({ message: 'Meta API token missing' });
        }

        // 1. Fetch media URL from Meta
        const metaUrl = `https://graph.facebook.com/v25.0/${mediaId}`;
        const metaResponse = await axios.get(metaUrl, {
            headers: { 'Authorization': `Bearer ${META_API_TOKEN}` }
        });

        const downloadUrl = metaResponse.data.url;
        const mimeType = metaResponse.data.mime_type || 'application/octet-stream';

        // Map mime type to extension for proper file downloading
        let extension = 'bin';
        if (mimeType.includes('image/jpeg')) extension = 'jpg';
        else if (mimeType.includes('image/png')) extension = 'png';
        else if (mimeType.includes('video/mp4')) extension = 'mp4';
        else if (mimeType.includes('audio/ogg')) extension = 'ogg'; // WhatsApp voice notes
        else if (mimeType.includes('audio/mpeg')) extension = 'mp3';
        else if (mimeType.includes('application/pdf')) extension = 'pdf';
        else if (mimeType.includes('text/csv')) extension = 'csv';
        else if (mimeType.includes('spreadsheetml')) extension = 'xlsx';
        else if (mimeType.includes('/')) extension = mimeType.split('/')[1].split(';')[0]; // generic fallback

        // 2. Fetch the actual binary data securely
        const mediaDownloadResponse = await axios({
            method: 'get',
            url: downloadUrl,
            headers: { 'Authorization': `Bearer ${META_API_TOKEN}` },
            responseType: 'stream'
        });

        // 4. Send the file back to the frontend
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Disposition', `inline; filename="whatsapp-media-${mediaId}.${extension}"`);
        mediaDownloadResponse.data.pipe(res);
    } catch (error: any) {
        console.error("Get Media Error:", error.response?.data || error.message);
        res.status(500).json({ message: 'Failed to fetch media', error: error.message });
    }
};

// @desc    Send a media reply (image, pdf, video) to a customer
// @route   POST /api/chats/media-reply
// @access  Private
export const sendMediaReply = async (req: Request, res: Response) => {
    try {
        const { business_id, customer_id, caption } = req.body;
        const file = req.file;

        if (!business_id || !customer_id || !file) {
            return res.status(400).json({ message: 'Missing required fields or file' });
        }

        const customer = await Customer.findById(customer_id);
        if (!customer) return res.status(404).json({ message: 'Customer not found' });

        // Ensure we are within the 24-hour window
        let windowIsOpen = false;
        const dbPhone = customer.phone.startsWith('+') ? customer.phone : '+' + customer.phone.replace(/[^0-9]/g, '');
        const patient = await Patient.findOne({ phone: dbPhone });
        
        const lastMessageTime = patient?.last_message_received_at || customer.last_interaction;
        if (lastMessageTime) {
            const hoursSinceLastMessage = (Date.now() - new Date(lastMessageTime).getTime()) / (1000 * 60 * 60);
            if (hoursSinceLastMessage < 24) {
                windowIsOpen = true;
            }
        }

        if (!windowIsOpen) {
            return res.status(400).json({ 
                message: '24-hour service window has closed. You can only send pre-approved templates.',
                windowClosed: true 
            });
        }

        // Send Media via WhatsApp Service
        const response = await sendWhatsAppMedia(
            customer.phone,
            file.buffer,
            file.mimetype,
            file.originalname,
            caption
        );

        // Save as outbound message
        const message = await Message.create({
            customer_id: customer._id,
            business_id: business_id,
            direction: 'outbound',
            message_type: response.messageType,
            status: 'sent',
            content: caption || '',
            media_id: response.metaMediaId,
            whatsapp_message_id: response.sid
        });

        res.status(200).json({ message: 'Media sent', data: message });
    } catch (error: any) {
        console.error("Send Media Reply Error:", error.response?.data || error);
        res.status(500).json({ message: 'Failed to send media', error: error.response?.data?.error?.message || error.message });
    }
};
