import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { tenantGuard } from '../db/plugins/tenantGuard';
import { toJSONPlugin } from '../db/plugins/toJSON';

const toolCallSchema = new Schema(
  {
    name: { type: String, required: true },
    input: { type: Schema.Types.Mixed, default: {} },
    resultCount: { type: Number },
    isError: { type: Boolean, default: false },
  },
  { _id: false },
);

const productRefSchema = new Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    category: { type: String },
    price: { type: Number },
    imageUrl: { type: String },
  },
  { _id: false },
);

const messageSchema = new Schema(
  {
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true },
    toolCalls: { type: [toolCallSchema], default: undefined },
    products: { type: [productRefSchema], default: undefined },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

// History lives on the server so the client cannot forge assistant turns.
const conversationSchema = new Schema(
  {
    company_id: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    messages: { type: [messageSchema], default: [] },
  },
  { timestamps: true },
);

conversationSchema.index({ company_id: 1, user_id: 1, updatedAt: -1 });
conversationSchema.plugin(tenantGuard);
conversationSchema.plugin(toJSONPlugin);

export type Conversation = InferSchemaType<typeof conversationSchema>;
export type ConversationDocument = HydratedDocument<Conversation>;
export const ConversationModel = model('Conversation', conversationSchema);
