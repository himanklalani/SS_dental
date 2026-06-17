import mongoose, { Document, Schema } from 'mongoose';

export interface IMessage extends Document {
  customer_id: mongoose.Types.ObjectId;
  business_id: mongoose.Types.ObjectId;
  direction?: 'inbound' | 'outbound';
  message_type?: 'text' | 'image' | 'document' | 'audio' | 'video' | 'template' | 'interactive' | 'button';
  status: 'queued' | 'sent' | 'delivered' | 'read' | 'clicked' | 'completed' | 'failed' | 'received';
  content: string;
  media_id?: string;
  media_url?: string;
  sent_at?: Date;
  clicked_at?: Date;
  scheduled_at?: Date;
  whatsapp_message_id?: string;
  createdAt: Date;
}

const MessageSchema: Schema = new Schema({
  customer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  business_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
  direction: { 
    type: String, 
    enum: ['inbound', 'outbound'],
    default: 'outbound'
  },
  message_type: { 
    type: String, 
    enum: ['text', 'image', 'document', 'audio', 'video', 'template', 'interactive', 'button'],
    default: 'text'
  },
  status: { 
    type: String, 
    enum: ['queued', 'sent', 'delivered', 'read', 'clicked', 'completed', 'failed', 'received'], 
    default: 'queued' 
  },
  content: { type: String, required: true },
  media_id: { type: String },
  media_url: { type: String },
  sent_at: { type: Date },
  clicked_at: { type: Date },
  scheduled_at: { type: Date },
  whatsapp_message_id: { type: String },
}, { timestamps: true });

export default mongoose.model<IMessage>('Message', MessageSchema);
