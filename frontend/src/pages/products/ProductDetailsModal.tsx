import { CalendarDays, MessageCircleQuestion, PackageX, Pencil, RefreshCw, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Badge, Skeleton } from '../../components/ui/misc';
import { useProduct } from '../../hooks/useProducts';
import { ApiError } from '../../lib/api';
import { formatDate, formatPrice } from '../../lib/format';
import type { Product } from '../../lib/types';
import { ProductImage } from './ProductCard';

interface Props {
  productId: string | null;
  initial?: Product;
  canEdit: boolean;
  onClose: () => void;
  onEdit: (p: Product) => void;
  onDelete: (p: Product) => void;
  /** Overrides "Ask the assistant" (in the chat it continues the current conversation). */
  onAsk?: (p: Product) => void;
}

export function ProductDetailsModal({ productId, initial, canEdit, onClose, onEdit, onDelete, onAsk }: Readonly<Props>) {
  const navigate = useNavigate();
  const { data: product, isLoading, error } = useProduct(productId, initial);

  const askAssistant = (p: Product) =>
    onAsk ? onAsk(p) : navigate('/chat', {
      state: { ask: `Quero saber mais sobre o ${p.name}: destaques, para quem é ideal e o que combina com ele.`, productId: p.id },
    });

  const notFound = error instanceof ApiError && error.status === 404;

  return (
    <Modal
      open={!!productId}
      onClose={onClose}
      title="Detalhes do produto"
      size="xl"
      footer={
        product && (
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
            {canEdit && (
              <div className="flex gap-2 sm:mr-auto">
                <Button
                  variant="ghost"
                  className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-500/10"
                  icon={<Trash2 className="h-4 w-4" />}
                  onClick={() => onDelete(product)}
                >
                  Excluir
                </Button>
                <Button variant="secondary" icon={<Pencil className="h-4 w-4" />} onClick={() => onEdit(product)}>
                  Editar
                </Button>
              </div>
            )}
            <Button icon={<MessageCircleQuestion className="h-4 w-4" />} onClick={() => askAssistant(product)}>
              Perguntar ao assistente
            </Button>
          </div>
        )
      }
    >
      {isLoading && (
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="aspect-square" />
          <div className="space-y-3">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-7 w-3/4" />
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-24" />
          </div>
        </div>
      )}
      {!isLoading && !product && (
        <div className="flex flex-col items-center py-10 text-center">
          <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-stone-100 dark:bg-stone-800"><PackageX className="h-7 w-7 text-stone-400" /></span>
          <p className="font-medium">{notFound ? 'Produto não encontrado' : 'Não foi possível carregar o produto'}</p>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            {notFound ? 'Ele pode ter sido excluído ou o link está incorreto.' : 'Tente novamente em instantes.'}
          </p>
        </div>
      )}
      {!isLoading && product && (
        <div className="grid gap-8 md:grid-cols-2">
          <div className="aspect-square overflow-hidden rounded-3xl bg-stone-100 ring-1 ring-stone-200/80 dark:bg-stone-800 dark:ring-stone-800">
            <ProductImage src={product.imageUrl} alt={product.name} />
          </div>

          <div className="flex flex-col">
            <Badge tone="brand" className="self-start">
              {product.category}
            </Badge>
            <h3 className="mt-3 font-display text-2xl leading-tight font-bold tracking-tight sm:text-3xl">{product.name}</h3>
            <p className="mt-3 inline-flex w-fit items-baseline gap-2 rounded-2xl bg-brand-50 px-4 py-2 text-3xl font-extrabold tracking-tight text-brand-800 tabular-nums dark:bg-brand-500/15 dark:text-brand-100">
              {formatPrice(product.price)}
            </p>

            <div className="mt-6 border-t border-stone-100 pt-5 dark:border-stone-800">
              <h4 className="mb-2 text-xs font-semibold tracking-wider text-stone-500 uppercase dark:text-stone-400">Descrição</h4>
              <p className="text-sm leading-relaxed whitespace-pre-line text-stone-700 dark:text-stone-300">
                {product.description || 'Este produto ainda não tem descrição.'}
              </p>
            </div>

            <dl className="mt-auto grid grid-cols-2 gap-3 pt-6 text-xs">
              <div className="rounded-2xl border border-stone-200/80 bg-stone-50 px-3.5 py-2.5 dark:border-stone-800 dark:bg-stone-800/40">
                <dt className="flex items-center gap-1.5 text-stone-500 dark:text-stone-400">
                  <CalendarDays className="h-3.5 w-3.5" /> Cadastrado em
                </dt>
                <dd className="mt-0.5 font-medium">{formatDate(product.createdAt)}</dd>
              </div>
              <div className="rounded-2xl border border-stone-200/80 bg-stone-50 px-3.5 py-2.5 dark:border-stone-800 dark:bg-stone-800/40">
                <dt className="flex items-center gap-1.5 text-stone-500 dark:text-stone-400">
                  <RefreshCw className="h-3.5 w-3.5" /> Atualizado em
                </dt>
                <dd className="mt-0.5 font-medium">{formatDate(product.updatedAt)}</dd>
              </div>
            </dl>
          </div>
        </div>
      )}
    </Modal>
  );
}
