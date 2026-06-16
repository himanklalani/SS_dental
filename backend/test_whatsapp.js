require('dotenv').config();
const axios = require('axios');
const phone = '+919004402797';
const cleanPhone = phone.replace('+', '');
const payload = {
  messaging_product: 'whatsapp',
  recipient_type: 'individual',
  to: cleanPhone,
  type: 'template',
  template: {
    name: 'hello_world',
    language: { code: 'en_US' }
  }
};
axios.post('https://graph.facebook.com/v25.0/' + process.env.META_PHONE_NUMBER_ID + '/messages', payload, {
  headers: {
    'Authorization': 'Bearer ' + process.env.META_API_TOKEN,
    'Content-Type': 'application/json'
  }
}).then(r => console.log('SUCCESS:', r.data))
  .catch(e => console.error('ERROR:', e.response?.data || e.message));
