import clsx from 'clsx';
import { ImageOff, Pencil, Sparkles, Trash2 } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { formatPrice } from '../../lib/format';
import type { Product } from '../../lib/types';

interface ProductImageProps {
  src: string;
  alt: string;
  className?: string;
  /** Above-the-fold images: fetch immediately instead of lazily. */
  priority?: boolean;
}

export function ProductImage({ src, alt, className, priority }: Readonly<ProductImageProps>) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  // Cached images may finish before React attaches onLoad.
  const imgRef = useCallback((el: HTMLImageElement | null) => {
    if (el?.complete && el.naturalWidth > 0) setLoaded(true);
  }, []);

  if (!src || failed) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-stone-100 to-stone-200 text-stone-400 dark:from-stone-800 dark:to-stone-900 dark:text-stone-600">
        <ImageOff className="h-8 w-8" />
      </div>
    );
  }
  return (
    <div className={clsx('relative h-full w-full', !loaded && 'animate-pulse bg-stone-200/70 dark:bg-stone-800')}>
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : undefined}
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={clsx('h-full w-full object-cover transition-opacity duration-300', loaded ? 'opacity-100' : 'opacity-0', className)}
      />
    </div>
  );
}

interface ProductCardProps {
  product: Product;
  canEdit: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAsk: () => void;
  priority?: boolean;
}

export function ProductCard({ product, canEdit, onOpen, onEdit, onDelete, onAsk, priority }: Readonly<ProductCardProps>) {
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-3xl border border-stone-200/80 bg-white shadow-card transition duration-300 hover:-translate-y-1 hover:border-stone-300 hover:shadow-lift dark:border-stone-800 dark:bg-stone-900 dark:hover:border-stone-700">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Ver detalhes de ${product.name}`}
        className="absolute inset-0 z-[1] cursor-pointer rounded-3xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
      />
      <div className="relative m-2 mb-0 aspect-[4/3.4] overflow-hidden rounded-[20px] bg-stone-100 dark:bg-stone-800">
        <ProductImage src={product.imageUrl} alt={product.name} priority={priority} className="transition duration-500 ease-out group-hover:scale-[1.06]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/25 to-transparent opacity-0 transition group-hover:opacity-100" />
        <span className="absolute top-3 left-3 max-w-[60%] truncate rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-stone-700 shadow-sm backdrop-blur dark:bg-stone-950/80 dark:text-stone-200">
          {product.category}
        </span>
        {canEdit && (
          <div className="absolute top-2.5 right-2.5 z-10 flex gap-1 transition sm:translate-y-1 sm:opacity-0 sm:group-focus-within:translate-y-0 sm:group-focus-within:opacity-100 sm:group-hover:translate-y-0 sm:group-hover:opacity-100">
            <Button
              variant="secondary"
              size="icon"
              className="h-8 w-8 rounded-full border-0 bg-white/95 backdrop-blur dark:bg-stone-900/95"
              aria-label={`Editar ${product.name}`}
              onClick={onEdit}
              icon={<Pencil className="h-3.5 w-3.5" />}
            />
            <Button
              variant="secondary"
              size="icon"
              className="h-8 w-8 rounded-full border-0 bg-white/95 text-red-600 backdrop-blur hover:text-red-700 dark:bg-stone-900/95 dark:text-red-400"
              aria-label={`Excluir ${product.name}`}
              onClick={onDelete}
              icon={<Trash2 className="h-3.5 w-3.5" />}
            />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col px-4 pt-3.5 pb-4">
        <h3 className="line-clamp-1 font-display text-[17px] leading-snug font-bold tracking-tight" title={product.name}>
          {product.name}
        </h3>
        {product.description && (
          <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-stone-500 dark:text-stone-400">{product.description}</p>
        )}
        <div className="mt-auto flex items-end justify-between gap-2 pt-4">
          <div className="leading-none">
            <p className="text-[11px] font-medium text-stone-400">Preço</p>
            <p className="mt-1 text-xl font-extrabold tracking-tight tabular-nums">{formatPrice(product.price)}</p>
          </div>
          <button
            type="button"
            onClick={onAsk}
            aria-label={`Perguntar ao assistente sobre ${product.name}`}
            title="Perguntar ao assistente"
            className="relative z-10 inline-flex h-9 items-center gap-1.5 rounded-full bg-brand-50 px-3.5 text-xs font-semibold text-brand-700 ring-1 ring-brand-600/10 transition ring-inset hover:bg-brand-600 hover:text-white hover:shadow-glow dark:bg-brand-500/15 dark:text-brand-200 dark:hover:bg-brand-500 dark:hover:text-white"
          >
            <Sparkles className="h-3.5 w-3.5" /> Perguntar
          </button>
        </div>
      </div>
    </article>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-3xl border border-stone-200/80 bg-white dark:border-stone-800 dark:bg-stone-900">
      <div className="m-2 aspect-[4/3.4] animate-pulse rounded-[20px] bg-stone-200/70 dark:bg-stone-800" />
      <div className="space-y-2.5 p-4">
        <div className="h-4 w-3/4 animate-pulse rounded bg-stone-200/70 dark:bg-stone-800" />
        <div className="h-3 w-full animate-pulse rounded bg-stone-200/70 dark:bg-stone-800" />
        <div className="h-6 w-1/3 animate-pulse rounded bg-stone-200/70 dark:bg-stone-800" />
      </div>
    </div>
  );
}
