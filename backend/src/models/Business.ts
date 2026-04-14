import mongoose, { Document, Schema } from 'mongoose';

export interface IBusiness extends Document {
  name: string;
  google_review_url: string;
  industry_type: string;
  message_templates: {
    service_category: string;
    template: string;
  }[];
  api_key: string;
  createdAt: Date;
}

const BusinessSchema: Schema = new Schema({
  name: { type: String, required: true },
  google_review_url: { type: String, required: true },
  industry_type: { type: String, required: true }, // e.g., 'restaurant', 'ecommerce', 'service'
  message_templates: [{
    service_category: { type: String, required: true },
    template: { type: String, required: true }
  }],
  api_key: { type: String, required: true, unique: true },
}, { timestamps: true });

export default mongoose.model<IBusiness>('Business', BusinessSchema);
