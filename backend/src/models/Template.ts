import mongoose, { Document, Schema } from 'mongoose';

export interface ITemplate extends Document {
    meta_template_id: string;
    name: string;
    language: string;
    category: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAUSED' | 'DISABLED';
    components: any[];
    business_id: mongoose.Types.ObjectId;
    rejected_reason?: string;
    media_id?: string;
    media_url?: string;
    media_uploaded_at?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const TemplateSchema: Schema = new Schema({
    meta_template_id: { type: String },
    name:             { type: String, required: true },
    language:         { type: String, required: true, default: 'en' },
    category:         { type: String, required: true, enum: ['UTILITY', 'MARKETING', 'AUTHENTICATION'] },
    status:           { type: String, required: true, default: 'PENDING', enum: ['PENDING', 'APPROVED', 'REJECTED', 'PAUSED', 'DISABLED'] },
    components:       [{ type: Schema.Types.Mixed }],
    business_id:      { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
    rejected_reason:  { type: String },
    media_id:         { type: String },   // WhatsApp media ID for free-form image sends (expires ~30 days)
    media_url:        { type: String },   // Future: public CDN URL for media re-upload on expiry
    media_uploaded_at:{ type: Date },     // Timestamp to detect expiry (>25 days = refresh needed)
}, { timestamps: true });

export default mongoose.model<ITemplate>('Template', TemplateSchema);
