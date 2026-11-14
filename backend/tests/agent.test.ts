import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { createCatalogTools } from '../src/modules/chat/agent/catalog.tools';
import type {
  AssistantMessage,
  LLMClient,
  LLMTurnOptions,
  LLMTurnRequest,
  MessageParam,
} from '../src/modules/chat/agent/llm.client';
import { HOME_PRODUCTS, TECH_PRODUCTS, auth, clearDb, createTenant, startDb, stopDb } from './helpers';

/** Returns scripted turns and records every request, so the tool loop runs end to end offline. */
type ScriptedTurn = { text?: string; toolUses?: { name: string; input: unknown }[] };

class FakeLLM implements LLMClient {
  requests: LLMTurnRequest[] = [];
  private script: ScriptedTurn[] = [];

  queue(...turns: ScriptedTurn[]) {
    this.script.push(...turns);
  }

  async streamTurn(req: LLMTurnRequest, { onText }: LLMTurnOptions): Promise<AssistantMessage> {
    this.requests.push(structuredClone(req));
    const turn = this.script.shift() ?? { text: 'end' };
    if (turn.text) for (const chunk of turn.text.match(/.{1,5}/g) ?? []) onText(chunk);
    const content = [
      ...(turn.text ? [{ type: 'text', text: turn.text, citations: null }] : []),
      ...(turn.toolUses ?? []).map((t, i) => ({ type: 'tool_use', id: `toolu_${this.requests.length}_${i}`, name: t.name, input: t.input })),
    ];
    return {
      id: `msg_${this.requests.length}`,
      type: 'message',
      role: 'assistant',
      model: 'fake',
      content,
      stop_reason: turn.toolUses?.length ? 'tool_use' : 'end_turn',
      stop_sequence: null,
    } as unknown as AssistantMessage;
  }
}

function lastToolResults(messages: MessageParam[]) {
  const last = messages[messages.length - 1]!;
  return (last.content as { type: string; content: string; is_error?: boolean }[]).filter((b) => b.type === 'tool_result');
}

const llm = new FakeLLM();
const app = createApp({ llm });
let A: Awaited<ReturnType<typeof createTenant>>;
let B: Awaited<ReturnType<typeof createTenant>>;

beforeAll(startDb);
afterAll(stopDb);
beforeEach(async () => {
  await clearDb();
  llm.requests = [];
  A = await createTenant('TechNova', TECH_PRODUCTS);
  B = await createTenant('Casa Bella', HOME_PRODUCTS);
});

describe('agent tools (tenant-scoped via closure)', () => {
  it("search_products only sees the tenant's catalog", async () => {
    const toolsA = createCatalogTools(A.companyId);
    const toolsB = createCatalogTools(B.companyId);

    const fromA = JSON.parse((await toolsA.execute('search_products', { query: 'laptop' })).content);
    expect(fromA.total_found).toBe(2);

    const fromB = JSON.parse((await toolsB.execute('search_products', { query: 'laptop' })).content);
    expect(fromB.total_found).toBe(0);

    const all = JSON.parse((await toolsB.execute('search_products', {})).content);
    expect(all.products.map((p: { name: string }) => p.name).sort()).toEqual(['Arc Floor Lamp', 'Aurora Sofa']);
  });

  it("get_product_details with another company's id → not found", async () => {
    const result = await createCatalogTools(A.companyId).execute('get_product_details', { product_id: B.products[0]!.id });
    expect(result.isError).toBe(true);
    expect(result.content).not.toContain('Sofa');
  });

  it('tool schemas do not expose company_id to the model', () => {
    const schemas = JSON.stringify(createCatalogTools(A.companyId).definitions);
    expect(schemas).not.toMatch(/company/i);
  });

  it('invalid input becomes an error tool_result (the model can correct itself)', async () => {
    const r = await createCatalogTools(A.companyId).execute('search_products', { limit: 500 });
    expect(r.isError).toBe(true);
    expect(r.content).toContain('limit');
  });

  it('price and category filters', async () => {
    const r = JSON.parse(
      (await createCatalogTools(A.companyId).execute('search_products', { category: 'laptops', max_price: 1000 })).content,
    );
    expect(r.products.map((p: { name: string }) => p.name)).toEqual(['Essential Laptop']);
  });
});

describe('POST /api/chat', () => {
  it("runs the tool_use → tool_result → answer loop with the tenant's real data", async () => {
    llm.queue(
      { toolUses: [{ name: 'search_products', input: { query: 'laptop', max_price: 1000 } }] },
      { text: 'We have the **Essential Laptop** for $599.00.' },
    );

    const res = await request(app)
      .post('/api/chat')
      .set(auth(A.user.token))
      .send({ message: 'Any laptop under $1,000?' })
      .expect(200);

    expect(res.body.reply).toContain('Essential Laptop');
    expect(res.body.toolCalls).toEqual([
      expect.objectContaining({ name: 'search_products', resultCount: 1, isError: false }),
    ]);

    expect(llm.requests).toHaveLength(2);
    const [toolResult] = lastToolResults(llm.requests[1]!.messages);
    expect(toolResult!.content).toContain('Essential Laptop');
    expect(toolResult!.content).not.toContain('Sofa');
    expect(llm.requests[0]!.system).toContain('TechNova');
  });

  it('the same question in another tenant does not leak data', async () => {
    llm.queue({ toolUses: [{ name: 'search_products', input: { query: 'laptop' } }] }, { text: 'Nothing found.' });
    await request(app).post('/api/chat').set(auth(B.user.token)).send({ message: 'Any laptops?' }).expect(200);
    const [toolResult] = lastToolResults(llm.requests[1]!.messages);
    expect(JSON.parse(toolResult!.content).total_found).toBe(0);
  });

  it('SSE streaming emits conversation, tool_call, tool_result, text and done', async () => {
    llm.queue({ toolUses: [{ name: 'list_categories', input: {} }] }, { text: 'We have Laptops and Audio.' });

    const res = await request(app)
      .post('/api/chat')
      .set(auth(A.user.token))
      .set('Accept', 'text/event-stream')
      .send({ message: 'Which categories?' })
      .buffer(true)
      .parse((r, cb) => {
        let data = '';
        r.on('data', (c: Buffer) => (data += c.toString()));
        r.on('end', () => cb(null, data));
      })
      .expect(200);

    expect(res.headers['content-type']).toContain('text/event-stream');
    const events = [...(res.body as string).matchAll(/^event: (\w+)$/gm)].map((m) => m[1]);
    expect(events[0]).toBe('conversation');
    expect(events).toContain('tool_call');
    expect(events).toContain('tool_result');
    expect(events).toContain('text');
    expect(events.at(-1)).toBe('done');
  });

  it('persists history and resends it with the next message', async () => {
    llm.queue({ text: 'Hi! How can I help?' }, { text: 'Sure.' });
    const first = await request(app).post('/api/chat').set(auth(A.user.token)).send({ message: 'Hi' }).expect(200);
    await request(app)
      .post('/api/chat')
      .set(auth(A.user.token))
      .send({ message: 'And now?', conversationId: first.body.conversationId })
      .expect(200);

    const sent = llm.requests[1]!.messages.map((m) => [m.role, m.content]);
    expect(sent).toEqual([
      ['user', 'Hi'],
      ['assistant', 'Hi! How can I help?'],
      ['user', 'And now?'],
    ]);

    const conv = await request(app)
      .get(`/api/chat/conversations/${first.body.conversationId}`)
      .set(auth(A.user.token))
      .expect(200);
    expect(conv.body.messages).toHaveLength(4);
  });

  it("another user's/company's conversation → 404", async () => {
    llm.queue({ text: 'Hi' });
    const mine = await request(app).post('/api/chat').set(auth(A.user.token)).send({ message: 'Hi' }).expect(200);
    const id = mine.body.conversationId;

    await request(app).get(`/api/chat/conversations/${id}`).set(auth(A.admin.token)).expect(404);
    await request(app).get(`/api/chat/conversations/${id}`).set(auth(B.user.token)).expect(404);
    await request(app).post('/api/chat').set(auth(B.user.token)).send({ message: 'x', conversationId: id }).expect(404);
  });

  it('respects the tool iteration limit', async () => {
    const loop = { toolUses: [{ name: 'list_categories', input: {} }] };
    llm.queue(loop, loop, loop, loop, loop, loop);
    const res = await request(app).post('/api/chat').set(auth(A.user.token)).send({ message: 'loop' }).expect(200);
    expect(llm.requests).toHaveLength(4); // AGENT_MAX_TOOL_ITERATIONS=4 in tests/setup.ts
    expect(res.body.reply).toMatch(/Não consegui concluir/);
  });

  it('productId injects the focus product into context (without saving it in history)', async () => {
    llm.queue({ text: 'It is ideal for travelers.' });
    const productId = A.products[0]!.id;
    const res = await request(app)
      .post('/api/chat')
      .set(auth(A.user.token))
      .send({ message: 'Tell me about this product', productId })
      .expect(200);

    const sent = JSON.stringify(llm.requests[0]!.messages.at(-1)!.content);
    expect(sent).toContain('focus_product');
    expect(sent).toContain(TECH_PRODUCTS[0]!.name);

    const conv = await request(app).get(`/api/chat/conversations/${res.body.conversationId}`).set(auth(A.user.token));
    expect(conv.body.messages[0].content).toBe('Tell me about this product');
  });

  it("another company's productId → 404 and nothing reaches the model", async () => {
    await request(app)
      .post('/api/chat')
      .set(auth(A.user.token))
      .send({ message: 'Tell me about this product', productId: B.products[0]!.id })
      .expect(404);
    expect(llm.requests).toHaveLength(0);
  });

  it('database products mentioned in the answer become references (and are saved in history)', async () => {
    llm.queue(
      { toolUses: [{ name: 'search_products', input: { query: 'laptop' } }] },
      // Mentions one of the 2 returned laptops (case-insensitive); "Ghost Laptop" is not from the database.
      { text: 'I recommend the **essential laptop**. Avoid the Ghost Laptop.' },
    );
    const res = await request(app).post('/api/chat').set(auth(A.user.token)).send({ message: 'laptop?' }).expect(200);

    const essential = A.products.find((p) => p.name === 'Essential Laptop')!;
    expect(res.body.products).toEqual([expect.objectContaining({ id: essential.id, name: 'Essential Laptop', price: 599 })]);

    const conv = await request(app).get(`/api/chat/conversations/${res.body.conversationId}`).set(auth(A.user.token));
    expect(conv.body.messages[1].products).toEqual([expect.objectContaining({ id: essential.id, name: 'Essential Laptop' })]);
  });

  it('validates the message', async () => {
    await request(app).post('/api/chat').set(auth(A.user.token)).send({ message: '   ' }).expect(400);
  });
});

describe('chat rate limit', () => {
  it('should not count invalid messages against the per-user quota', async () => {
    const limited = createApp({ llm, rateLimit: true });
    for (let i = 0; i < 25; i++) {
      await request(limited).post('/api/chat').set(auth(A.user.token)).send({ message: '' }).expect(400);
    }
    await request(limited).post('/api/chat').set(auth(A.user.token)).send({ message: 'hi' }).expect(200);
  });

  it('should still limit valid messages to 20 per minute', async () => {
    const limited = createApp({ llm, rateLimit: true });
    for (let i = 0; i < 20; i++) {
      await request(limited).post('/api/chat').set(auth(A.user.token)).send({ message: `hi ${i}` }).expect(200);
    }
    await request(limited).post('/api/chat').set(auth(A.user.token)).send({ message: 'one more' }).expect(429);
  });
});
