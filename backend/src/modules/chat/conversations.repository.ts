import { Types, isValidObjectId } from 'mongoose';
import { ConversationModel } from '../../models/conversation.model';
import type { AgentToolCall } from './agent/agent.service';
import type { ProductRef } from './agent/catalog.tools';

/** Scoped by company AND user: teammates can't see each other's chats. */
export const conversationsRepository = {
  listForUser(companyId: string, userId: string) {
    return ConversationModel.find({ company_id: companyId, user_id: userId })
      .select('title createdAt updatedAt')
      .sort({ updatedAt: -1 })
      .limit(50);
  },

  findForUser(companyId: string, userId: string, id: string) {
    if (!isValidObjectId(id)) return Promise.resolve(null);
    return ConversationModel.findOne({ _id: id, company_id: companyId, user_id: userId });
  },

  create(companyId: string, userId: string, title: string) {
    return ConversationModel.create({
      company_id: new Types.ObjectId(companyId),
      user_id: new Types.ObjectId(userId),
      title,
      messages: [],
    });
  },

  async appendExchange(
    companyId: string,
    id: string,
    user: string,
    assistant: { content: string; toolCalls: AgentToolCall[]; products: ProductRef[] },
  ) {
    await ConversationModel.updateOne(
      { _id: id, company_id: companyId },
      {
        $push: {
          messages: {
            $each: [
              { role: 'user', content: user },
              { role: 'assistant', content: assistant.content, toolCalls: assistant.toolCalls, products: assistant.products },
            ],
          },
        },
      },
    );
  },

  async delete(companyId: string, userId: string, id: string) {
    if (!isValidObjectId(id)) return false;
    const r = await ConversationModel.deleteOne({ _id: id, company_id: companyId, user_id: userId });
    return r.deletedCount === 1;
  },
};
