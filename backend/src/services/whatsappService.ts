import axios from 'axios';
import Business from '../models/Business';
import Patient from '../models/Patient';

const META_API_TOKEN = process.env.META_API_TOKEN;
const META_PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID;

export const sendWhatsAppMessage = async (phone: string, name: string, service_type: string, business_id: any, customMessage?: string, templateName?: string, appointmentId?: string, templateParams?: string[], replyToMessageId?: string) => {
  
  const business = await Business.findById(business_id);
  if (!business) {
      throw new Error('Business not found for message sending');
  }

  // Ensure Phone is purely numeric
  const cleanPhone = phone.replace('+', '').replace(/\s/g, '').replace(/[^0-9]/g, '');

  if (!META_API_TOKEN || !META_PHONE_NUMBER_ID) {
     console.warn(`[Meta API] Missing configs. Would have sent to ${cleanPhone}: ${customMessage || templateName}`);
     return { sid: 'mock_sid_' + Date.now() };
  }

  const url = `https://graph.facebook.com/v25.0/${META_PHONE_NUMBER_ID}/messages`;
  let payload: any = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: cleanPhone
  };

  if (replyToMessageId) {
      payload.context = { message_id: replyToMessageId };
  }

  // Check 24h window
  let windowIsOpen = false;
  const dbPhone = phone.startsWith('+') ? phone : '+' + cleanPhone;
  const patient = await Patient.findOne({ phone: dbPhone });
  if (patient && patient.last_message_received_at) {
      const hoursSinceLastMessage = (Date.now() - patient.last_message_received_at.getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastMessage < 24) {
          windowIsOpen = true;
      }
  }

  try {
      // SMART ROUTING INTERCEPTION
      let overrideToFreeForm = false;
      let freeFormPayload: any = null;

      if ((windowIsOpen || templateName === 'auto_reply_hello') && templateName) {
          if (templateName === 'auto_reply_hello') {
              overrideToFreeForm = true;
              freeFormPayload = {
                  type: "text",
                  text: { body: `Hello! Welcome to Dr. Saachi Shingrani's Dental Care.\n\nTo book an appointment, please visit our website: www.srsdentalcare.in` }
              };
          } else if (templateName === 'booking_confirmations') {
               overrideToFreeForm = true;
               freeFormPayload = {
                   type: "interactive",
                   interactive: {
                       type: "button",
                       body: { text: `Hi ${name}, your appointment for ${templateParams?.[3] || service_type} is scheduled on ${templateParams?.[1]} at ${templateParams?.[2]} at Dr. Saachi Shingrani's Dental Care. See you soon!` },
                       action: {
                           buttons: [
                               { type: "reply", reply: { id: "ok_confirmed", title: "Okay, Confirmed" } }
                           ]
                       }
                   }
               };
          } else if (templateName === 'appointment_reminder') {
               overrideToFreeForm = true;
               freeFormPayload = {
                   type: "interactive",
                   interactive: {
                       type: "button",
                       body: { text: `Hi ${name}, this is a friendly reminder that you have an appointment for ${templateParams?.[1] || service_type} today at ${templateParams?.[2]}. We look forward to seeing you!` },
                       action: {
                           buttons: [
                               { type: "reply", reply: { id: "ok_confirm_remind", title: "Ok, Confirm" } }
                           ]
                       }
                   }
               };
          } else if (templateName === 'thank_you_simple' || templateName === 'review_request') {
               overrideToFreeForm = true;
               const reviewUrl = `https://review-booking-system.onrender.com/api/r/${appointmentId}`;
               freeFormPayload = {
                   type: "text",
                   text: { body: `Hi ${name}, thank you for visiting us for your ${service_type}. We hope you had a great experience! Could you please take a moment to leave us a review?\n\nLeave a review here: ${reviewUrl}` }
               };
          }
      }

      if (overrideToFreeForm) {
          payload.type = freeFormPayload.type;
          if (freeFormPayload.type === 'interactive') payload.interactive = freeFormPayload.interactive;
          if (freeFormPayload.type === 'text') payload.text = freeFormPayload.text;
          console.log(`[Meta API] Smart Routing: Intercepted ${templateName} -> Sending Free Form Message to ${cleanPhone}`);
      } else if (templateName) {
          // Default backwards compatible mapping if templateParams not provided
          const defaultParams = [
              { type: "text", text: name },
              { type: "text", text: business.name },
              { type: "text", text: customMessage || service_type }
          ];

          payload.type = "template";
          payload.template = {
              name: templateName,
              language: {
                  code: templateName === 'hello_world' ? 'en_US' : 'en'
              }
          };

          if (templateName !== 'hello_world') {
              payload.template.components = [
                  {
                      type: "body",
                      parameters: templateParams ? templateParams.map(text => ({ type: "text", text })) : defaultParams
                  }
              ];
          }

          // If review request, append the full URL proxy to the body parameters instead of a button
          if (templateName === 'review_request' || templateName === 'review_follow_up') {
              if (!appointmentId) throw new Error("Appointment ID required for review proxy tracking");
              
              const appDomain = 'https://review-booking-system.onrender.com';
              const trackingUrl = `${appDomain}/api/r/${appointmentId}`;
              
              // Find the body component and append the link as the next variable (e.g. {{3}})
              const bodyComponent = payload.template.components.find((c: any) => c.type === 'body');
              if (bodyComponent && bodyComponent.parameters) {
                  bodyComponent.parameters.push({ type: 'text', text: trackingUrl });
              }
          }
      } else {
          // Send as freestyle Text Message
          payload.type = "text";
          payload.text = { body: customMessage };
      }

      console.log(`[Meta API] Sending message to ${cleanPhone}...`);

      const sendPayload = async (currentPayload: any) => {
          return await axios.post(url, currentPayload, {
              headers: {
                  'Authorization': `Bearer ${META_API_TOKEN}`,
                  'Content-Type': 'application/json'
              }
          });
      };

      try {
          const response = await sendPayload(payload);
          console.log(`[Meta API] Message sent! SID: ${response.data.messages?.[0]?.id}`);
          return { sid: response.data.messages?.[0]?.id };
      } catch (error: any) {
          // If template language error (132001), try en_US and then en_GB
          if (error.response?.data?.error?.code === 132001 && payload.type === 'template') {
              console.log(`[Meta API] Language code ${payload.template.language.code} failed for template ${templateName}. Retrying with en_US...`);
              payload.template.language.code = 'en_US';
              try {
                  const responseUS = await sendPayload(payload);
                  console.log(`[Meta API] Message sent with en_US! SID: ${responseUS.data.messages?.[0]?.id}`);
                  return { sid: responseUS.data.messages?.[0]?.id };
              } catch (errUS: any) {
                  if (errUS.response?.data?.error?.code === 132001) {
                      console.log(`[Meta API] Language code en_US failed. Retrying with en_GB...`);
                      payload.template.language.code = 'en_GB';
                      const responseGB = await sendPayload(payload);
                      console.log(`[Meta API] Message sent with en_GB! SID: ${responseGB.data.messages?.[0]?.id}`);
                      return { sid: responseGB.data.messages?.[0]?.id };
                  }
                  throw errUS;
              }
          }
          throw error;
      }

  } catch (error: any) {
      console.error(`[Meta API] Failed: ${JSON.stringify(error.response?.data || error.message)}`);
      throw error;
  }
};

import FormData from 'form-data';

export const sendWhatsAppMedia = async (phone: string, fileBuffer: Buffer, mimeType: string, filename: string, caption?: string, replyToMessageId?: string) => {
    // Ensure Phone is purely numeric
    const cleanPhone = phone.replace('+', '').replace(/\s/g, '').replace(/[^0-9]/g, '');

    if (!META_API_TOKEN || !META_PHONE_NUMBER_ID) {
        throw new Error("Missing Meta API configurations.");
    }

    try {
        // Step 1: Upload media to Meta
        console.log(`[Meta API] Uploading media to Meta servers...`);
        const form = new FormData();
        form.append('messaging_product', 'whatsapp');
        form.append('file', fileBuffer, { 
            filename, 
            contentType: mimeType,
            knownLength: fileBuffer.length
        });

        const uploadUrl = `https://graph.facebook.com/v25.0/${META_PHONE_NUMBER_ID}/media`;
        const uploadResponse = await axios.post(uploadUrl, form, {
            headers: {
                'Authorization': `Bearer ${META_API_TOKEN}`,
                ...form.getHeaders()
            }
        });

        const metaMediaId = uploadResponse.data.id;
        console.log(`[Meta API] Upload successful! Media ID: ${metaMediaId}`);

        // Step 2: Send message with the Media ID
        const messageUrl = `https://graph.facebook.com/v25.0/${META_PHONE_NUMBER_ID}/messages`;
        
        let messageType = 'document';
        if (mimeType.startsWith('image/')) messageType = 'image';
        else if (mimeType.startsWith('video/')) messageType = 'video';
        else if (mimeType.startsWith('audio/')) messageType = 'audio';

        const payload: any = {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: cleanPhone,
            type: messageType,
            [messageType]: {
                id: metaMediaId,
            }
        };

        if (caption && (messageType === 'image' || messageType === 'video' || messageType === 'document')) {
            payload[messageType].caption = caption;
        }
        
        // For documents, it's highly recommended to provide a filename
        if (messageType === 'document') {
             payload[messageType].filename = filename;
        }

        if (replyToMessageId) {
            payload.context = { message_id: replyToMessageId };
        }

        console.log(`[Meta API] Dispatching media message to ${cleanPhone}...`);
        const sendResponse = await axios.post(messageUrl, payload, {
            headers: {
                'Authorization': `Bearer ${META_API_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        console.log(`[Meta API] Media message sent! SID: ${sendResponse.data.messages?.[0]?.id}`);
        return { 
            sid: sendResponse.data.messages?.[0]?.id,
            metaMediaId,
            messageType
        };

    } catch (error: any) {
        console.error(`[Meta API Media] Failed: ${JSON.stringify(error.response?.data || error.message)}`);
        throw error;
    }
};
