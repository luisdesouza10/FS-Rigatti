import { ApiError, CSRF_HEADERS, parseError } from './api';
import type { ProductRef } from './types';

export type ChatStreamEvent =
  | { event: 'conversation'; data: { id: string; title: string } }
  | { event: 'tool_call'; data: { id: string; name: string; input: Record<string, unknown> } }
  | { event: 'tool_result'; data: { id: string; name: string; resultCount?: number; isError: boolean } }
  | { event: 'text'; data: { delta: string } }
  | { event: 'products'; data: { items: ProductRef[] } }
  | { event: 'done'; data: { conversationId: string } }
  | { event: 'error'; data: { message: string } };

/** Parses one SSE block ("event: …" / "data: …" lines); null when it carries no data (e.g. a keep-alive comment). */
function parseSseBlock(raw: string): ChatStreamEvent | null {
  let event = 'message';
  const data: string[] = [];
  for (const line of raw.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) data.push(line.slice(5).trimStart());
  }
  if (!data.length) return null;
  return { event, data: JSON.parse(data.join('\n')) } as ChatStreamEvent;
}

/** SSE over fetch: native EventSource supports neither POST nor the CSRF header the API requires on writes. */
export async function streamChat(params: {
  message: string;
  conversationId?: string;
  productId?: string;
  signal?: AbortSignal;
  onEvent: (e: ChatStreamEvent) => void;
}): Promise<void> {
  let res: Response;
  try {
    res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', ...CSRF_HEADERS },
      body: JSON.stringify({ message: params.message, conversationId: params.conversationId, productId: params.productId }),
      signal: params.signal,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new ApiError(0, 'Não foi possível conectar ao servidor.');
  }
  if (!res.ok || !res.body) throw await parseError(res);

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;

    // Events are separated by a blank line; an incomplete one stays in the buffer.
    const blocks = buffer.split('\n\n');
    buffer = blocks.pop() ?? '';
    for (const raw of blocks) {
      const event = parseSseBlock(raw);
      if (event) params.onEvent(event);
    }
  }
}
