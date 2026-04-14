import mongoose, { Document, Schema } from 'mongoose';

export interface IMessage extends Document {
  customer_id: mongoose.Types.ObjectId;
  business_id: mongoose.Types.ObjectId;
  status: 'queued' | 'sent' | 'delivered' | 'clicked' | 'completed' | 'failed';
  content: string;
  sent_at?: Date;
  clicked_at?: Date;
  scheduled_at?: Date;
  whatsapp_message_id?: string;
  createdAt: Date;
}

const MessageSchema: Schema = new Schema({
  customer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  business_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
  status: { 
    type: String, 
    enum: ['queued', 'sent', 'delivered', 'clicked', 'completed', 'failed'], 
    default: 'queued' 
  },
  content: { type: String, required: true },
  sent_at: { type: Date },
  clicked_at: { type: Date },
  scheduled_at: { type: Date },
  whatsapp_message_id: { type: String },
}, { timestamps: true });

export default mongoose.model<IMessage>('Message', MessageSchema);
