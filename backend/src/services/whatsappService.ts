import axios from 'axios';
import Business from '../models/Business';

const META_API_TOKEN = process.env.META_API_TOKEN;
const META_PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID;

export const sendWhatsAppMessage = async (phone: string, name: string, service_type: string, business_id: any, customMessage?: string, templateName?: string, appointmentId?: string) => {
  
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

  try {
      if (templateName) {
          // Send as Template Message (Required for outbound non-24h window)
          payload.type = "template";
          payload.template = {
              name: templateName,
              language: {
                  code: "en_US"
              },
              components: [
                  {
                      type: "body",
                      parameters: [
                          { type: "text", text: name },
                          { type: "text", text: business.name },
                          { type: "text", text: customMessage || service_type }
                      ]
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
