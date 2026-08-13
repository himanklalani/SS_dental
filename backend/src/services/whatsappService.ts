import axios from 'axios';
import Business from '../models/Business';
import Patient from '../models/Patient';
import Customer from '../models/Customer';
import Message from '../models/Message';
import Template from '../models/Template';

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
      // 1. Generate readable representation of templates
      let readableTemplateText = '';
      if (templateName === 'auto_reply_hello') {
          readableTemplateText = `Hello! Welcome to Dr. Saachi Shingrani's Dental Care.\n\nTo book an appointment, please visit our website: www.srsdentalcare.in`;
      } else if (templateName === 'booking_confirmations') {
          readableTemplateText = `Hi ${name}, your appointment for ${templateParams?.[3] || service_type} is scheduled on ${templateParams?.[1]} at ${templateParams?.[2]} at Dr. Saachi Shingrani's Dental Care. See you soon!\n\n(Please reply "Yes" to confirm)`;
      } else if (templateName === 'appointment_reminder') {
          readableTemplateText = `Hi ${name}, this is a friendly reminder that you have an appointment for ${templateParams?.[1] || service_type} today at ${templateParams?.[2]}. We look forward to seeing you!\n\n(Please reply "Yes" to confirm)`;
      } else if (templateName === 'thank_you_simple') {
          readableTemplateText = `Greetings ${name}, thank you for visiting Dr. Saachi Shingrani's Dental Care today for your ${service_type} session.`;
      } else if (templateName === 'review_request') {
          const reviewUrl = appointmentId ? `https://review-booking-system.onrender.com/api/r/${appointmentId}` : 'https://g.page/r/Cb40ziDcqQoHEAE/review';
          readableTemplateText = `Hi ${name}, thank you for visiting us for your ${service_type}. We hope you had a great experience! Could you please take a moment to leave us a review?\n\nLeave a review here: ${reviewUrl}`;
      } else if (templateName === 'review_follow_up') {
          const reviewUrl = appointmentId ? `https://review-booking-system.onrender.com/api/r/${appointmentId}` : 'https://g.page/r/Cb40ziDcqQoHEAE/review';
          readableTemplateText = `Hi ${name}, this is a gentle follow-up from Dr. Saachi Shingrani's Dental Care regarding your recent ${service_type}. We would truly appreciate it if you could share your feedback with us: ${reviewUrl}`;
      } else if (templateName === 'review_request_no_followup') {
          const reviewUrl = appointmentId ? `https://review-booking-system.onrender.com/api/r/${appointmentId}` : 'https://g.page/r/Cb40ziDcqQoHEAE/review';
          readableTemplateText = `Greetings ${name} from Dr Saachi Shingrani's Dental Care, it would be really helpful if you shared your review about us:\n${reviewUrl}\n\nThank You!`;
      } else if (templateName === 'generic_clinic_msg') {
          readableTemplateText = `Greetings from Dr. Saachi Shingrani's Dental Care, ${name}, we sincerely hope you are doing well. Please feel free to reach out to us or book your next appointment at your convenience or send a text here. 😊\n\nVisit our website: https://www.srsdentalcare.in\nCall us: +919004402797`;
      } else if (templateName === 'appointment_cancelled') {
          readableTemplateText = `Greetings ${name}, as requested, your appointment at Dr. Saachi Shingrani's Dental Care for your ${templateParams?.[1] || service_type} has been successfully cancelled.`;
      } else if (templateName === 'appointment_rescheduled') {
          readableTemplateText = `Greetings ${name}, your appointment at Dr. Saachi Shingrani's Dental Care has been updated to ${templateParams?.[1]} at ${templateParams?.[2]} for ${templateParams?.[3] || service_type}. The previous time slot is now cancelled. Looking forward to seeing you! 😊`;
      } else if (templateName) {
          // ── DYNAMIC TEMPLATE LOOKUP ──────────────────────────────────────────────
          // Template is not a hardcoded system template — look it up from our DB
          try {
              const dbTemplate = await Template.findOne({ name: templateName, status: 'APPROVED' });
              if (dbTemplate) {
                  const bodyComp = dbTemplate.components.find((c: any) => c.type === 'BODY');
                  if (bodyComp?.text) {
                      // Count variables in template: {{1}}, {{2}}, etc.
                      const varMatches = bodyComp.text.match(/\{\{\d+\}\}/g) || [];
                      const varValues: Record<string, string> = {};
                      varMatches.forEach((v: string) => {
                          const idx = parseInt(v.replace(/\D/g, ''));
                          if (idx === 1) varValues[v] = name;
                          else if (idx === 2) varValues[v] = service_type || business.name;
                          else varValues[v] = ' '; // safe fallback for extra vars
                      });
                      // Build readable text by replacing {{n}} with actual values
                      let reconstructed = bodyComp.text;
                      Object.entries(varValues).forEach(([key, val]) => {
                          reconstructed = reconstructed.split(key).join(val);
                      });
                      // Unescape \n stored by Meta as literal \n
                      readableTemplateText = reconstructed.replace(/\\n/g, '\n');
                      // Attach media_id to freeFormPayload data so interceptor can send image
                      (payload as any).__dbTemplate = dbTemplate;
                  }
              }
          } catch (lookupErr) {
              console.warn('[Meta API] Custom template DB lookup failed (non-fatal):', lookupErr);
          }
      }

      // 2. SMART ROUTING INTERCEPTION
      let overrideToFreeForm = false;
      let freeFormPayload: any = null;

      if ((windowIsOpen || templateName === 'auto_reply_hello') && templateName && readableTemplateText) {
           overrideToFreeForm = true;
           // Check if the custom DB template has a valid, non-expired media_id
           const dbTemplate = (payload as any).__dbTemplate;
           const isMediaExpired = dbTemplate?.media_uploaded_at
               ? (Date.now() - new Date(dbTemplate.media_uploaded_at).getTime()) > 25 * 24 * 60 * 60 * 1000
               : true;
           const mediaId = dbTemplate?.media_id && !isMediaExpired ? dbTemplate.media_id : null;

           if (mediaId) {
               // Determine image type from stored component
               const headerComp = dbTemplate.components?.find((c: any) => c.type === 'HEADER');
               const mediaType = (headerComp?.format || 'IMAGE').toLowerCase();
               freeFormPayload = {
                   type: mediaType,
                   [mediaType]: { id: mediaId, caption: readableTemplateText }
               };
               console.log(`[Meta API] Smart Routing: Intercepting with image (media_id: ${mediaId}) + caption`);
           } else {
               freeFormPayload = {
                   type: 'text',
                   text: { body: readableTemplateText }
               };
           }
      }

      if (overrideToFreeForm) {
          payload.type = freeFormPayload.type;
          if (freeFormPayload.type === 'interactive') payload.interactive = freeFormPayload.interactive;
          if (freeFormPayload.type === 'text') payload.text = freeFormPayload.text;
          if (freeFormPayload.type === 'image') { payload.type = 'image'; payload.image = freeFormPayload.image; }
          if (freeFormPayload.type === 'video') { payload.type = 'video'; payload.video = freeFormPayload.video; }
          if (freeFormPayload.type === 'document') { payload.type = 'document'; payload.document = freeFormPayload.document; }
          console.log(`[Meta API] Smart Routing: Intercepted ${templateName} -> Sending Free Form (${freeFormPayload.type}) to ${cleanPhone}`);
      } else if (templateName) {
          // Default backwards compatible mapping if templateParams not provided
          // Note: review templates have hardcoded clinic names in Meta, so they only take Name (1) and Service (2).
          const isReviewTemplate = templateName === 'review_request' || templateName === 'review_follow_up';
          
          // For custom DB templates: build params dynamically based on actual variable count
          const dbTemplate = (payload as any).__dbTemplate;
          let defaultParams: any[];
          if (dbTemplate) {
              const bodyComp = dbTemplate.components.find((c: any) => c.type === 'BODY');
              const varMatches = bodyComp?.text?.match(/\{\{\d+\}\}/g) || [];
              const uniqueVars = [...new Set(varMatches.map((v: string) => parseInt(v.replace(/\D/g, ''))))].sort() as number[];
              defaultParams = uniqueVars.map((idx: number) => {
                  if (idx === 1) return { type: 'text', text: name };
                  if (idx === 2) return { type: 'text', text: service_type || business.name };
                  return { type: 'text', text: ' ' }; // safe fallback for extra vars
              });
              if (defaultParams.length === 0) defaultParams = [{ type: 'text', text: name }];
          } else if (isReviewTemplate) {
              defaultParams = [
                  { type: 'text', text: name },
                  { type: 'text', text: customMessage || service_type }
              ];
          } else {
              defaultParams = [
                  { type: 'text', text: name },
                  { type: 'text', text: business.name },
                  { type: 'text', text: customMessage || service_type }
              ];
          }

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
          if (templateName === 'review_request' || templateName === 'review_follow_up' || templateName === 'review_request_no_followup') {
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

      // Determine the text content for inbox logging
      let inboxContent = '';
      if (overrideToFreeForm && freeFormPayload?.text?.body) {
          inboxContent = freeFormPayload.text.body;
      } else if (customMessage) {
          inboxContent = customMessage;
      } else if (templateName) {
          inboxContent = readableTemplateText 
              ? `[Meta Template Sent]\n\n${readableTemplateText}` 
              : `[Template: ${templateName}]`;
      }

      const saveToInbox = async (sid: string) => {
          try {
              // Resolve the name: prefer Patient DB name for new contacts
              const dbPhoneFmt = phone.startsWith('+') ? phone : '+' + cleanPhone;
              const patientRecord = await Patient.findOne({ phone: dbPhoneFmt });
              const resolvedName = patientRecord?.name || name || 'Unknown Patient';

              // Find or create Customer — NEVER overwrite an existing name
              let customer = await Customer.findOne({ phone: dbPhoneFmt, business_id: business._id });
              if (!customer) {
                  customer = await Customer.create({
                      phone: dbPhoneFmt,
                      name: resolvedName,
                      service_type: service_type || 'General',
                      business_id: business._id,
                      last_interaction: new Date()
                  });
                  console.log(`[Inbox] Created new customer for ${dbPhoneFmt} as "${resolvedName}"`);
              } else if (customer.name === 'Unknown Patient' && resolvedName !== 'Unknown Patient') {
                  // Only auto-fix the name if it's still the default placeholder
                  customer.name = resolvedName;
                  await customer.save();
                  console.log(`[Inbox] Updated customer name from "Unknown Patient" to "${resolvedName}"`);
              }

              // Save the outbound message
              if (inboxContent) {
                  await Message.create({
                      customer_id: customer._id,
                      business_id: business._id,
                      direction: 'outbound',
                      message_type: overrideToFreeForm ? 'text' : (templateName ? 'template' : 'text'),
                      status: 'sent',
                      content: inboxContent,
                      whatsapp_message_id: sid
                  });
                  console.log(`[Inbox] Saved outbound message for ${dbPhoneFmt}: ${inboxContent.substring(0, 60)}...`);
              }
          } catch (inboxErr) {
              // Never let inbox logging break the main send flow
              console.error('[Inbox] Failed to save to inbox (non-fatal):', inboxErr);
          }
      };

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
          const sid = response.data.messages?.[0]?.id;
          console.log(`[Meta API] Message sent! SID: ${sid}`);
          await saveToInbox(sid);
          return { sid };
      } catch (error: any) {
          // If template language error (132001), try en_US and then en_GB
          if (error.response?.data?.error?.code === 132001 && payload.type === 'template') {
              console.log(`[Meta API] Language code ${payload.template.language.code} failed for template ${templateName}. Retrying with en_US...`);
              payload.template.language.code = 'en_US';
              try {
                  const responseUS = await sendPayload(payload);
                  const sidUS = responseUS.data.messages?.[0]?.id;
                  console.log(`[Meta API] Message sent with en_US! SID: ${sidUS}`);
                  await saveToInbox(sidUS);
                  return { sid: sidUS };
              } catch (errUS: any) {
                  if (errUS.response?.data?.error?.code === 132001) {
                      console.log(`[Meta API] Language code en_US failed. Retrying with en_GB...`);
                      payload.template.language.code = 'en_GB';
                      const responseGB = await sendPayload(payload);
                      const sidGB = responseGB.data.messages?.[0]?.id;
                      console.log(`[Meta API] Message sent with en_GB! SID: ${sidGB}`);
                      await saveToInbox(sidGB);
                      return { sid: sidGB };
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

export const sendWhatsAppReaction = async (phone: string, messageId: string, emoji: string) => {
    const cleanPhone = phone.replace('+', '').replace(/\s/g, '').replace(/[^0-9]/g, '');

    if (!META_API_TOKEN || !META_PHONE_NUMBER_ID) {
        console.warn(`[Meta API] Missing configs. Would have reacted to ${messageId} with ${emoji}`);
        return { sid: 'mock_sid_' + Date.now() };
    }

    const url = `https://graph.facebook.com/v25.0/${META_PHONE_NUMBER_ID}/messages`;
    
    // An empty emoji string un-reacts the message
    const payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: cleanPhone,
        type: "reaction",
        reaction: {
            message_id: messageId,
            emoji: emoji
        }
    };

    try {
        console.log(`[Meta API] Sending reaction ${emoji} to ${cleanPhone} for message ${messageId}...`);
        const response = await axios.post(url, payload, {
            headers: {
                'Authorization': `Bearer ${META_API_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        console.log(`[Meta API] Reaction sent!`);
        return { sid: response.data?.messages?.[0]?.id };
    } catch (error: any) {
        console.error('[Meta API] Reaction Failed:', error.response?.data || error.message);
        throw error;
    }
};
