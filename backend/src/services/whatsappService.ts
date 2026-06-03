import axios from 'axios';
import Business from '../models/Business';
import Patient from '../models/Patient';

const META_API_TOKEN = process.env.META_API_TOKEN;
const META_PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID;

export const sendWhatsAppMessage = async (phone: string, name: string, service_type: string, business_id: any, customMessage?: string, templateName?: string, appointmentId?: string, templateParams?: string[]) => {
  
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

      if (windowIsOpen && templateName) {
          if (templateName === 'auto_reply_hello') {
              overrideToFreeForm = true;
              freeFormPayload = {
                  type: "text",
                  text: { body: `Hello! Welcome to Dr. Saachi Shingrani's Dental Care.\n\nTo book an appointment, please visit our website: https://srs-website-tan.vercel.app/book` }
              };
          } else if (templateName === 'booking_confirmation') {
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
                  code: "en_US"
              },
              components: [
                  {
                      type: "body",
                      parameters: templateParams ? templateParams.map(text => ({ type: "text", text })) : defaultParams
                  }
              ]
          };

          // If review request, add a URL button parameter targeting our tracking proxy
          if (templateName === 'review_request' || templateName === 'review_follow_up') {
              if (!appointmentId) throw new Error("Appointment ID required for review proxy tracking");
              
              const appDomain = process.env.APP_DOMAIN || 'http://localhost:5000';
              payload.template.components.push({
                  type: "button",
                  sub_type: "url",
                  index: "0",
                  parameters: [
                      {
                          type: "text",
                          // The suffix matches the variable in the Meta template button URL config. e.g. https://domain.com/{{1}}
                          text: `api/r/${appointmentId}` 
                      }
                  ]
              });
          }
      } else {
          // Send as freestyle Text Message
          payload.type = "text";
          payload.text = { body: customMessage };
      }

      console.log(`[Meta API] Sending message to ${cleanPhone}...`);
      const response = await axios.post(url, payload, {
          headers: {
              'Authorization': `Bearer ${META_API_TOKEN}`,
              'Content-Type': 'application/json'
          }
      });
      
      console.log(`[Meta API] Message sent! SID: ${response.data.messages?.[0]?.id}`);
      return { sid: response.data.messages?.[0]?.id };

  } catch (error: any) {
      console.error(`[Meta API] Failed: ${JSON.stringify(error.response?.data || error.message)}`);
      throw error;
  }
};
