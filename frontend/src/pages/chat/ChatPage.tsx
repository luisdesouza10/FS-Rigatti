import { useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { ArrowUpRight, Gem, History, LayoutGrid, Menu, MessageSquare, MessageSquarePlus, Scale, Trash2, Wallet, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useOutletContext } from 'react-router';
import type { AppLayoutContext } from '../../components/layout/AppLayout';
import { toast } from 'sonner';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/misc';
import { useAuth } from '../../context/AuthContext';
import { ApiError, api } from '../../lib/api';
import { streamChat } from '../../lib/chatStream';
import { relativeTime } from '../../lib/format';
import type { ChatMessage, Conversation, ConversationSummary } from '../../lib/types';
import { ProductDetailsModal } from '../products/ProductDetailsModal';
import { AssistantAvatar } from './AssistantAvatar';
import { ChatMessageItem } from './ChatMessageItem';
import { Composer } from './Composer';

const SUGGESTIONS = [
  { icon: LayoutGrid, title: 'Explorar categorias', text: 'Quais categorias de produtos vocês têm?' },
  { icon: Wallet, title: 'Dentro do orçamento', text: 'Me recomende algo até R$ 500' },
  { icon: Gem, title: 'O mais premium', text: 'Qual é o produto mais caro do catálogo?' },
  { icon: Scale, title: 'Comparar', text: 'Compare os dois produtos mais baratos' },
];

// Local React keys only. crypto.randomUUID() needs HTTPS, and the app is also served over the LAN.
let uidSeq = 0;
const uid = () => `m${Date.now().toString(36)}-${(uidSeq++).toString(36)}`;

export function ChatPage() {
  const { user, company } = useAuth();
  const qc = useQueryClient();
  const { openMenu } = useOutletContext<AppLayoutContext>();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [viewingProductId, setViewingProductId] = useState<string | null>(null);

  const activeIdRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  const conversations = useQuery({
    queryKey: ['conversations'],
    queryFn: () => api<{ items: ConversationSummary[] }>('/chat/conversations').then((r) => r.items),
  });

  // A question handed over from another screen is sent once; setTimeout + cleanup survives StrictMode's double mount.
  const location = useLocation();
  const navigate = useNavigate();
  const pendingAsk = useRef((location.state as { ask?: string; productId?: string } | null) ?? null);
  useEffect(() => {
    const ask = pendingAsk.current;
    if (!ask?.ask) return;
    const timer = setTimeout(() => {
      pendingAsk.current = null;
      void navigate('.', { replace: true, state: null }); // so a refresh doesn't resend it
      void sendRef.current(ask.ask!, ask.productId);
    }, 0);
    return () => clearTimeout(timer);
  }, [navigate]);

  useEffect(() => () => abortRef.current?.abort(), []);

  // Only auto-scroll if the user was already at the bottom.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottom.current) el.scrollTo({ top: el.scrollHeight });
  }, [messages]);

  const selectConversation = useCallback(async (id: string | null) => {
    abortRef.current?.abort();
    setHistoryOpen(false);
    activeIdRef.current = id;
    setActiveId(id);
    stickToBottom.current = true;
    if (!id) {
      setMessages([]);
      return;
    }
    setLoadingConversation(true);
    try {
      const conv = await api<Conversation>(`/chat/conversations/${id}`);
      setMessages(conv.messages.map((m) => ({ ...m, id: m.id ?? m._id ?? uid() })));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível abrir a conversa');
      setMessages([]);
    } finally {
      setLoadingConversation(false);
    }
  }, []);

  const deleteConversation = async (id: string) => {
    try {
      await api(`/chat/conversations/${id}`, { method: 'DELETE' });
      if (activeIdRef.current === id) void selectConversation(null);
      void qc.invalidateQueries({ queryKey: ['conversations'] });
    } catch {
      toast.error('Não foi possível excluir a conversa');
    }
  };

  const send = async (text: string, productId?: string) => {
    if (streaming) return;
    const assistantId = uid();
    stickToBottom.current = true;
    setMessages((ms) => [
      ...ms,
      { id: uid(), role: 'user', content: text },
      { id: assistantId, role: 'assistant', content: '', toolCalls: [], streaming: true },
    ]);
    setStreaming(true);

    const update = (fn: (m: ChatMessage) => ChatMessage) =>
      setMessages((ms) => ms.map((m) => (m.id === assistantId ? fn(m) : m)));

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await streamChat({
        message: text,
        conversationId: activeIdRef.current ?? undefined,
        productId,
        signal: controller.signal,
        onEvent: (e) => {
          switch (e.event) {
            case 'conversation':
              if (!activeIdRef.current) {
                activeIdRef.current = e.data.id;
                setActiveId(e.data.id);
              }
              break;
            case 'tool_call':
              update((m) => ({ ...m, toolCalls: [...(m.toolCalls ?? []), { ...e.data, pending: true }] }));
              break;
            case 'tool_result':
              update((m) => ({
                ...m,
                toolCalls: m.toolCalls?.map((t) =>
                  t.id === e.data.id ? { ...t, pending: false, resultCount: e.data.resultCount, isError: e.data.isError } : t,
                ),
              }));
              break;
            case 'products':
              update((m) => ({ ...m, products: e.data.items }));
              break;
            case 'text':
              update((m) => ({ ...m, content: m.content + e.data.delta }));
              break;
            case 'error':
              update((m) => ({ ...m, content: e.data.message, error: true }));
              break;
          }
        },
      });
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        update((m) => ({ ...m, content: m.content || '_Resposta interrompida._' }));
      } else {
        update((m) => ({ ...m, content: err instanceof ApiError ? err.message : 'Falha ao falar com o assistente.', error: true }));
      }
    } finally {
      update((m) => ({ ...m, streaming: false, toolCalls: m.toolCalls?.map((t) => ({ ...t, pending: false })) }));
      setStreaming(false);
      abortRef.current = null;
      void qc.invalidateQueries({ queryKey: ['conversations'] });
    }
  };

  const sendRef = useRef(send);
  sendRef.current = send;

  const firstName = user?.name.split(' ')[0] ?? '';
  const empty = messages.length === 0 && !loadingConversation;

  const historyPanel = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 p-4">
        <Button size="sm" className="flex-1" icon={<MessageSquarePlus className="h-4 w-4" />} onClick={() => selectConversation(null)}>
          Nova conversa
        </Button>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Fechar histórico" onClick={() => setHistoryOpen(false)} icon={<X className="h-4 w-4" />} />
      </div>
      <p className="px-5 pt-1 pb-2 text-[11px] font-semibold tracking-wider text-stone-400 uppercase">Conversas recentes</p>
      <div className="scroll-thin flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
        {conversations.isLoading &&
          Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="mx-1 my-1.5 h-9" />)}
        {conversations.data?.length === 0 && (
          <div className="mx-2 mt-2 rounded-2xl border border-dashed border-stone-200 px-4 py-6 text-center dark:border-stone-800">
            <MessageSquare className="mx-auto h-5 w-5 text-stone-300 dark:text-stone-600" />
            <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">Suas conversas aparecerão aqui.</p>
          </div>
        )}
        {conversations.data?.map((c) => (
          <div
            key={c.id}
            className={clsx(
              'group flex items-center rounded-xl transition',
              c.id === activeId ? 'bg-brand-50 ring-1 ring-brand-600/10 dark:bg-brand-500/15 dark:ring-brand-400/10' : 'hover:bg-stone-100 dark:hover:bg-stone-800',
            )}
          >
            <button type="button" onClick={() => selectConversation(c.id)} className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2.5 text-left">
              <MessageSquare className={clsx('h-4 w-4 shrink-0', c.id === activeId ? 'text-brand-600 dark:text-brand-300' : 'text-stone-400')} />
              <span className="min-w-0 flex-1">
              <p className={clsx('truncate text-sm', c.id === activeId ? 'font-semibold text-brand-700 dark:text-brand-300' : 'text-stone-700 dark:text-stone-300')}>
                {c.title}
              </p>
              <p className="text-[11px] text-stone-400">{relativeTime(c.updatedAt)}</p>
              </span>
            </button>
            <button
              type="button"
              aria-label={`Excluir conversa ${c.title}`}
              onClick={() => deleteConversation(c.id)}
              className="mr-1.5 rounded-lg p-1.5 text-stone-400 opacity-0 transition group-hover:opacity-100 hover:bg-stone-200 hover:text-red-600 focus:opacity-100 dark:hover:bg-stone-700"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex h-full">
      <aside className="hidden w-72 shrink-0 border-r border-stone-200/80 bg-white/60 lg:block dark:border-stone-800 dark:bg-stone-900/50">
        {historyPanel}
      </aside>

      {historyOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Fechar histórico"
            tabIndex={-1}
            className="absolute inset-0 animate-fade-in cursor-default bg-stone-950/45 backdrop-blur-sm"
            onClick={() => setHistoryOpen(false)}
          />
          <aside className="absolute inset-y-0 right-0 w-80 max-w-[85vw] animate-slide-in-right bg-white shadow-2xl dark:bg-stone-900">{historyPanel}</aside>
        </div>
      )}

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-stone-200/80 bg-white/70 px-2 backdrop-blur sm:h-[72px] sm:gap-3 sm:px-6 dark:border-stone-800 dark:bg-stone-900/60">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            {/* The app's mobile top bar is hidden here, so the menu lives in this header. */}
            <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menu" onClick={openMenu} icon={<Menu className="h-5 w-5" />} />
            <div className="relative shrink-0">
              <AssistantAvatar className="h-8 w-8 sm:h-10 sm:w-10" />
              <span className="absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-stone-900" />
            </div>
            <div className="min-w-0">
              <p className="truncate font-display font-bold">Assistente da {company?.name}</p>
              <p className="truncate text-xs text-stone-500 dark:text-stone-400">
                {streaming ? <span className="font-medium text-brand-600 dark:text-brand-300">Escrevendo…</span> : 'Respostas com base no catálogo da loja'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 lg:hidden">
            <Button variant="ghost" size="icon" aria-label="Nova conversa" onClick={() => selectConversation(null)} icon={<MessageSquarePlus className="h-4 w-4" />} />
            <Button variant="ghost" size="icon" aria-label="Histórico" onClick={() => setHistoryOpen(true)} icon={<History className="h-4 w-4" />} />
          </div>
        </header>

        <div
          ref={scrollRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
          }}
          className="scroll-thin min-h-0 flex-1 overflow-y-auto"
        >
          <div className="mx-auto w-full max-w-3xl px-4 py-4 sm:px-6 sm:py-6">
            {loadingConversation && (
              <div className="space-y-6">
                <Skeleton className="ml-auto h-10 w-2/3" />
                <Skeleton className="h-24 w-5/6" />
              </div>
            )}
            {!loadingConversation && empty && (
              <div className="flex min-h-[55vh] animate-slide-up flex-col items-center justify-center text-center">
                <div className="relative">
                  <div className="absolute inset-0 scale-150 rounded-full bg-brand-400/25 blur-2xl dark:bg-brand-500/20" />
                  <AssistantAvatar className="relative h-16 w-16" />
                </div>
                <h2 className="mt-6 font-display text-3xl font-bold tracking-tight">
                  Olá, {firstName}! <span className="text-stone-400">Como posso ajudar?</span>
                </h2>
                <p className="mt-2 max-w-md text-sm text-stone-500 dark:text-stone-400">
                  Pergunte sobre produtos, preços ou o que comprar. As respostas vêm do catálogo da {company?.name}.
                </p>
                <div className="mt-8 grid w-full max-w-2xl gap-3 text-left sm:grid-cols-2">
                  {SUGGESTIONS.map(({ icon: Icon, title, text }) => (
                    <button
                      key={text}
                      type="button"
                      onClick={() => send(text)}
                      className="group flex items-start gap-3 rounded-2xl text-left border border-stone-200/80 bg-white p-4 shadow-card transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-lift dark:border-stone-800 dark:bg-stone-900 dark:hover:border-brand-500/40"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 transition group-hover:bg-brand-600 group-hover:text-white dark:bg-brand-500/15 dark:text-brand-300">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold">{title}</span>
                        <span className="mt-0.5 block text-xs text-stone-500 dark:text-stone-400">{text}</span>
                      </span>
                      <ArrowUpRight className="h-4 w-4 shrink-0 text-stone-300 transition group-hover:text-brand-600 dark:text-stone-600" />
                    </button>
                  ))}
                </div>
              </div>
            )}
            {!loadingConversation && !empty && (
              <div className="space-y-7">
                {messages.map((m) => (
                  <ChatMessageItem key={m.id} message={m} onOpenProduct={setViewingProductId} />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="shrink-0 bg-gradient-to-t from-stone-50 via-stone-50 to-transparent px-3 pt-2 pb-2 sm:px-6 sm:pt-3 sm:pb-4 dark:from-stone-950 dark:via-stone-950">
          <div className="mx-auto max-w-3xl">
            <Composer streaming={streaming} onSend={send} onStop={() => abortRef.current?.abort()} autoFocusKey={activeId} />
            <p className="mt-1.5 text-center text-[11px] text-stone-400 sm:mt-2">
              As respostas podem conter erros.<span className="hidden sm:inline"> Enter envia, Shift+Enter quebra a linha.</span>
            </p>
          </div>
        </div>
      </section>

      <ProductDetailsModal
        productId={viewingProductId}
        canEdit={false}
        onClose={() => setViewingProductId(null)}
        onEdit={() => undefined}
        onDelete={() => undefined}
        onAsk={(p) => {
          setViewingProductId(null);
          void send(`Quero saber mais sobre o ${p.name}: destaques, para quem é ideal e o que combina com ele.`, p.id);
        }}
      />
    </div>
  );
}
