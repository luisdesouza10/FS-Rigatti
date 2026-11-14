import Anthropic from '@anthropic-ai/sdk';
import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { logger } from '../../config/logger';
import { authenticate } from '../../middlewares/authenticate';
import { CompanyModel } from '../../models/company.model';
import { productsRepository } from '../products/products.repository';
import { AppError, NotFoundError } from '../../shared/errors';
import { getTenant } from '../../shared/tenant';
import type { AgentEvent, AgentService, FocusProduct } from './agent/agent.service';
import { conversationsRepository } from './conversations.repository';
import { openSse } from './sse';

const chatInputSchema = z.object({
  message: z.string().trim().min(1, 'Mensagem vazia').max(2000, 'Mensagem muito longa'),
  conversationId: z.string().optional(),
  /** Product the customer is viewing ("Ask the assistant" button). */
  productId: z.string().optional(),
});

const HISTORY_WINDOW = 20;

function describeLlmError(err: unknown): { status: number; message: string } {
  if (err instanceof Anthropic.AuthenticationError) {
    return { status: 503, message: 'Agente indisponível: credencial da Anthropic ausente ou inválida (ANTHROPIC_API_KEY).' };
  }
  if (err instanceof Anthropic.RateLimitError) {
    return { status: 429, message: 'O agente está com alta demanda. Tente novamente em alguns segundos.' };
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return { status: 503, message: 'Não foi possível contatar o provedor de IA. Tente novamente.' };
  }
  if (err instanceof Anthropic.BadRequestError && /credit balance/i.test(err.message)) {
    return { status: 503, message: 'Agente indisponível: a conta da Anthropic está sem créditos (Plans & Billing no console).' };
  }
  if (err instanceof Anthropic.APIError) {
    return { status: 502, message: 'O provedor de IA retornou um erro. Tente novamente.' };
  }
  if (err instanceof Error && /api key|apiKey|authentication/i.test(err.message)) {
    return { status: 503, message: 'Agente indisponível: configure ANTHROPIC_API_KEY no .env.' };
  }
  return { status: 500, message: 'Erro ao processar sua mensagem.' };
}

type ProductRecord = Awaited<ReturnType<typeof productsRepository.findById>>;

function toFocusProduct(product: ProductRecord): FocusProduct | undefined {
  if (!product) return undefined;
  return {
    id: product.id,
    name: product.name,
    category: product.category,
    price: product.price,
    imageUrl: product.imageUrl,
    description: product.description,
  };
}

/** Reports an agent failure over SSE, or throws it for the JSON error handler. */
function reportAgentFailure(err: unknown, sse: ReturnType<typeof openSse> | null) {
  logger.error({ err }, 'Agent failure');
  const { status, message } = describeLlmError(err);
  if (!sse) throw new AppError(status, message, 'AGENT_ERROR');
  sse.send('error', { message });
  sse.close();
}

export function createChatRouter(agent: AgentService, chatRateLimit: RequestHandler) {
  const router = Router();
  router.use(authenticate);

  router.get('/conversations', async (req, res) => {
    const { companyId, userId } = getTenant(req);
    res.json({ items: await conversationsRepository.listForUser(companyId, userId) });
  });

  router.get('/conversations/:id', async (req, res) => {
    const { companyId, userId } = getTenant(req);
    const conversation = await conversationsRepository.findForUser(companyId, userId, req.params.id);
    if (!conversation) throw new NotFoundError('Conversa');
    res.json(conversation);
  });

  router.delete('/conversations/:id', async (req, res) => {
    const { companyId, userId } = getTenant(req);
    if (!(await conversationsRepository.delete(companyId, userId, req.params.id))) throw new NotFoundError('Conversa');
    res.status(204).end();
  });

  /**
   * `Accept: text/event-stream` → SSE (conversation, tool_call, tool_result, text, products, done, error);
   * otherwise JSON `{ conversationId, reply, toolCalls, products }`.
   */
  // Validated before the limiter, so malformed requests (which never reach the model)
  // don't spend the user's quota.
  const validateChatInput: RequestHandler = (req, res, next) => {
    res.locals.chatInput = chatInputSchema.parse(req.body);
    next();
  };

  router.post('/', validateChatInput, chatRateLimit, async (req, res) => {
    const { companyId, userId } = getTenant(req);
    const input = res.locals.chatInput as z.infer<typeof chatInputSchema>;

    const company = await CompanyModel.findById(companyId).select('name').lean();
    if (!company) throw new NotFoundError('Empresa');

    const product = input.productId ? await productsRepository.findById(companyId, input.productId) : null;
    if (input.productId && !product) throw new NotFoundError('Produto');

    const conversation = input.conversationId
      ? await conversationsRepository.findForUser(companyId, userId, input.conversationId)
      : await conversationsRepository.create(companyId, userId, input.message.slice(0, 80));
    if (!conversation) throw new NotFoundError('Conversa');

    const history = conversation.messages
      .slice(-HISTORY_WINDOW)
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    const wantsStream = req.accepts(['application/json', 'text/event-stream']) === 'text/event-stream';

    // Client disconnected → cancel the LLM call so we don't pay for unused tokens.
    const abort = new AbortController();
    res.on('close', () => {
      if (!res.writableFinished) abort.abort();
    });

    const sse = wantsStream ? openSse(res) : null;
    sse?.send('conversation', { id: conversation.id, title: conversation.title });
    const emit = (event: AgentEvent) => sse?.send(event.type, event);

    try {
      const result = await agent.run(
        {
          companyId,
          companyName: company.name,
          history,
          message: input.message,
          focusProduct: toFocusProduct(product),
        },
        emit,
        abort.signal,
      );
      await conversationsRepository.appendExchange(companyId, conversation.id, input.message, {
        content: result.text || '…',
        toolCalls: result.toolCalls,
        products: result.products,
      });

      if (sse) {
        sse.send('done', { conversationId: conversation.id, stopReason: result.stopReason });
        sse.close();
      } else {
        res.json({ conversationId: conversation.id, reply: result.text, toolCalls: result.toolCalls, products: result.products });
      }
    } catch (err) {
      // Don't keep a brand-new conversation whose first exchange failed.
      if (!input.conversationId) {
        await conversationsRepository.delete(companyId, userId, conversation.id).catch(() => undefined);
      }
      if (!abort.signal.aborted) reportAgentFailure(err, sse);
    }
  });

  return router;
}
