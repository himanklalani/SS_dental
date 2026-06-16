const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  // Default to test DB if not specified
  const db = mongoose.connection.useDb('test'); 
  const Business = db.collection('businesses');
  const b = await Business.findOne({});
  console.log('BUSINESS_ID:', b ? b._id.toString() : 'None');
  process.exit(0);
}

run().catch(console.error);
