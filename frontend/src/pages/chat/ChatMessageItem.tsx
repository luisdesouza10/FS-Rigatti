import clsx from 'clsx';
import { AlertCircle, Check, ChevronRight, FolderTree, Loader2, PackageSearch, ScanSearch } from 'lucide-react';
import { isValidElement, memo, type ReactNode } from 'react';
import Markdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { formatPrice, normalizeText } from '../../lib/format';
import type { ChatMessage, ProductRef, ToolCall } from '../../lib/types';
import { ProductImage } from '../products/ProductCard';
import { AssistantAvatar } from './AssistantAvatar';

function describeTool(call: ToolCall): { icon: typeof PackageSearch; label: string; detail?: string } {
  const input = call.input ?? {};
  switch (call.name) {
    case 'search_products': {
      const parts: string[] = [];
      if (typeof input.query === 'string' && input.query) parts.push(`“${input.query}”`);
      if (typeof input.category === 'string' && input.category) parts.push(input.category);
      if (typeof input.min_price === 'number') parts.push(`a partir de ${formatPrice(input.min_price)}`);
      if (typeof input.max_price === 'number') parts.push(`até ${formatPrice(input.max_price)}`);
      return { icon: PackageSearch, label: 'Buscou no catálogo', detail: parts.join(' · ') || 'todos os produtos' };
    }
    case 'get_product_details':
      return { icon: ScanSearch, label: 'Consultou detalhes do produto' };
    case 'list_categories':
      return { icon: FolderTree, label: 'Listou as categorias' };
    default:
      return { icon: PackageSearch, label: call.name };
  }
}

function ToolChip({ call }: Readonly<{ call: ToolCall }>) {
  const { icon: Icon, label, detail } = describeTool(call);
  return (
    <div className="inline-flex max-w-full animate-fade-in items-center gap-2 rounded-full border border-stone-200/80 bg-white px-3 py-1.5 text-xs text-stone-600 shadow-card dark:border-stone-800 dark:bg-stone-900 dark:text-stone-300">
      <Icon className="h-3.5 w-3.5 shrink-0 text-brand-600 dark:text-brand-300" />
      <span className="font-medium">{label}</span>
      {detail && <span className="truncate text-stone-500 dark:text-stone-400">{detail}</span>}
      <span className="ml-0.5 flex shrink-0 items-center gap-1 text-stone-400">
        <ToolStatus call={call} />
      </span>
    </div>
  );
}

function ToolStatus({ call }: Readonly<{ call: ToolCall }>) {
  if (call.pending) return <Loader2 className="h-3 w-3 animate-spin" />;
  if (call.isError) return <AlertCircle className="h-3 w-3 text-amber-500" />;
  return (
    <>
      <Check className="h-3 w-3 text-emerald-500" />
      {call.resultCount != null && call.name !== 'get_product_details' && (
        <span>
          {call.resultCount} {call.resultCount === 1 ? 'resultado' : 'resultados'}
        </span>
      )}
    </>
  );
}

function textOf(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children);
  return '';
}

/** Matches bold text to a mentioned product (full name, or at least 60% of it). */
function matchProduct(text: string, products: ProductRef[]): ProductRef | undefined {
  const t = normalizeText(text);
  if (t.length < 4) return undefined;
  return products.find((p) => {
    const name = normalizeText(p.name);
    return t.includes(name) || (name.includes(t) && t.length >= name.length * 0.6);
  });
}

function ProductRefCard({ product, onOpen }: Readonly<{ product: ProductRef; onOpen: () => void }>) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex w-64 shrink-0 items-center gap-3 rounded-2xl border border-stone-200/80 bg-white p-2 pr-3 text-left shadow-card transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-lift focus-visible:outline-2 focus-visible:outline-brand-500 dark:border-stone-700 dark:bg-stone-900 dark:hover:border-brand-500/40"
    >
      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl">
        <ProductImage src={product.imageUrl} alt="" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold">{product.name}</p>
        <p className="text-[11px] text-stone-500 dark:text-stone-400">{product.category}</p>
        <p className="mt-0.5 text-sm font-extrabold">{formatPrice(product.price)}</p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-stone-300 transition group-hover:translate-x-0.5 group-hover:text-brand-600 dark:text-stone-600" />
    </button>
  );
}

interface ChatMessageItemProps {
  message: ChatMessage;
  onOpenProduct: (id: string) => void;
}

export const ChatMessageItem = memo(function ChatMessageItem({ message, onOpenProduct }: ChatMessageItemProps) {
  const products = message.products ?? [];

  const components: Components = {
    strong: ({ children }) => {
      const product = matchProduct(textOf(children), products);
      if (!product) return <strong>{children}</strong>;
      return (
        <button
          type="button"
          onClick={() => onOpenProduct(product.id)}
          title="Ver detalhes do produto"
          className="cursor-pointer font-semibold text-brand-700 underline decoration-brand-300 underline-offset-4 transition hover:decoration-brand-700 dark:text-brand-300 dark:decoration-brand-500/50 dark:hover:decoration-brand-300"
        >
          {children}
        </button>
      );
    },
  };

  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] animate-slide-up rounded-3xl rounded-br-lg bg-gradient-to-br from-brand-500 to-brand-700 px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap text-white shadow-glow sm:max-w-[75%]">
          {message.content}
        </div>
      </div>
    );
  }

  const thinking = message.streaming && !message.content && !message.toolCalls?.some((t) => t.pending);

  return (
    <div className="flex animate-fade-in gap-3">
      <AssistantAvatar className="mt-0.5 h-8 w-8" />
      <div className="min-w-0 flex-1 space-y-2.5">
        {!!message.toolCalls?.length && (
          <div className="flex flex-col items-start gap-1.5">
            {message.toolCalls.map((call, i) => (
              <ToolChip key={call.id ?? i} call={call} />
            ))}
          </div>
        )}

        {thinking && (
          <div className="flex h-6 items-center gap-1" aria-label="Pensando">
            {[0, 150, 300].map((d) => (
              <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-stone-400" style={{ animationDelay: `${d}ms` }} />
            ))}
          </div>
        )}

        {message.content && (
          <div
            className={clsx(
              'prose prose-sm prose-zinc max-w-none dark:prose-invert',
              'prose-p:my-1.5 prose-ul:my-2 prose-li:my-0.5 prose-strong:font-semibold',
              message.streaming && 'streaming-cursor',
              message.error && 'rounded-lg bg-red-50 px-3.5 py-2.5 text-red-700 dark:bg-red-500/10 dark:text-red-300',
            )}
          >
            <Markdown remarkPlugins={[remarkGfm]} components={components}>
              {message.content}
            </Markdown>
          </div>
        )}

        {products.length > 0 && !message.streaming && (
          <div className="animate-fade-in pt-1">
            <p className="mb-2 text-[11px] font-semibold tracking-wider text-stone-500 uppercase dark:text-stone-400">
              Produtos citados
            </p>
            <div className="scroll-thin -mx-1 flex gap-2.5 overflow-x-auto px-1 pt-0.5 pb-2">
              {products.map((p) => (
                <ProductRefCard key={p.id} product={p} onOpen={() => onOpenProduct(p.id)} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
