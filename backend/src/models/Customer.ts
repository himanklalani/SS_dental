import mongoose, { Document, Schema } from 'mongoose';

export interface ICustomer extends Document {
  name: string;
  phone: string;
  service_type: string; // e.g., 'dining', 'oil_change', 'product_purchase'
  business_id: mongoose.Types.ObjectId;
  last_interaction: Date;
  opt_out: boolean;
  createdAt: Date;
}

const CustomerSchema: Schema = new Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  service_type: { type: String, required: true },
  business_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
  last_interaction: { type: Date, default: Date.now },
  opt_out: { type: Boolean, default: false },
}, { timestamps: true });

// Compound index to ensure unique customer per business (optional, but good for uniqueness if required)
// CustomerSchema.index({ phone: 1, business_id: 1 }, { unique: true });

export default mongoose.model<ICustomer>('Customer', CustomerSchema);
