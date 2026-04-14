import Queue from 'bull';
import { sendWhatsAppMessage } from './whatsappService';
import Message from '../models/Message';

// Connect to Redis (ensure Redis is running or provide URL)
const reviewQueue = new Queue('review-requests', process.env.REDIS_URL || 'redis://127.0.0.1:6379');

// Handle Redis connection errors gracefully
reviewQueue.on('error', (error) => {
  // console.error('Redis Queue Error:', error.message);
  // In production, you might want to alert monitoring services
});

reviewQueue.on('failed', (job, error) => {
  console.error(`Job ${job.id} failed:`, error.message);
});

interface ReviewJobData {
  customer_id: any;
  business_id: any;
  phone: string;
  name: string;
  service_type: string;
}

// Extracted processor logic for reuse/fallback
export const processReviewJob = async (data: ReviewJobData) => {
  const { customer_id, business_id, phone, name, service_type } = data;

  console.log(`Processing review request for ${name} (${phone})`);

  try {
    // 1. Create a Message record with status 'queued' (if not already created)
    
    // 2. Send WhatsApp Message
    const result = await sendWhatsAppMessage(phone, name, service_type, business_id, undefined, 'review_request');

    // 3. Update Message record
    await Message.create({
        customer_id,
        business_id,
        status: 'sent',
        content: 'review_request', // template used
        sent_at: new Date(),
        whatsapp_message_id: result.sid
    });

    console.log(`Message sent to ${name}`);
    return result;

  } catch (error) {
    console.error(`Failed to send message to ${name}:`, error);
    // Create failed message record
    await Message.create({
        customer_id,
        business_id,
        status: 'failed',
        content: 'Failed to send',
        sent_at: new Date()
    });
    throw error;
  }
};

reviewQueue.process(async (job) => {
  await processReviewJob(job.data as ReviewJobData);
});

export const queueReviewRequest = async (data: ReviewJobData, delay: number = 0) => {
  const isRedisReady = reviewQueue.client.status === 'ready';
  
  if (!isRedisReady) {
     console.warn('[Queue] Redis not ready. Executing job immediately (Fallback).');
     // If delay is requested, we might want to respect it using setTimeout, 
     // but for testing immediate is often better or use simple timeout.
     if (delay > 0) {
         setTimeout(() => {
             processReviewJob(data).catch(err => console.error('[Queue] Fallback execution failed:', err));
         }, delay);
     } else {
         await processReviewJob(data);
     }
     return;
  }

  try {
    await reviewQueue.add(data, {
        delay: delay,
        attempts: 3,
        backoff: {
        type: 'exponential',
        delay: 5000
        }
    });
  } catch (error) {
    console.error('[Queue] Failed to add to Redis queue. Executing immediately (Fallback).', error);
    await processReviewJob(data);
  }
};
