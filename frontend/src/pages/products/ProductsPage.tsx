import clsx from 'clsx';
import { ArrowUpDown, Boxes, ChevronLeft, ChevronRight, Eye, LayoutGrid, PackageSearch, Plus, Search, Sparkles, Store, Tag, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { EmptyState } from '../../components/ui/misc';
import { useAuth } from '../../context/AuthContext';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useCategories, useDeleteProduct, useProducts, type ProductSort } from '../../hooks/useProducts';
import { ApiError } from '../../lib/api';
import { formatPrice } from '../../lib/format';
import type { CategorySummary, Paginated, Product } from '../../lib/types';
import { ProductCard, ProductCardSkeleton } from './ProductCard';
import { ProductDetailsModal } from './ProductDetailsModal';
import { ProductFormModal } from './ProductFormModal';

export function ProductsPage() {
  const { isAdmin, company } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>();
  const [sort, setSort] = useState<ProductSort>('newest');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search.trim());

  const products = useProducts({ search: debouncedSearch || undefined, category, sort, page });
  const categories = useCategories();
  const deleteProduct = useDeleteProduct();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [toDelete, setToDelete] = useState<Product | null>(null);

  // The open product lives in the URL (?product=<id>) so the link is shareable and Back closes it.
  const [searchParams, setSearchParams] = useSearchParams();
  const viewingId = searchParams.get('produto');
  const openDetails = (p: Product) =>
    setSearchParams((prev) => {
      prev.set('produto', p.id);
      return prev;
    });
  const closeDetails = () =>
    setSearchParams(
      (prev) => {
        prev.delete('produto');
        return prev;
      },
      { replace: true },
    );

  const openForm = (p: Product | null) => {
    setEditing(p);
    setFormOpen(true);
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    try {
      await deleteProduct.mutateAsync(toDelete.id);
      toast.success('Produto excluído');
      setToDelete(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível excluir');
    }
  };

  const data = products.data;
  const hasFilters = !!debouncedSearch || !!category;

  const cats = categories.data ?? [];
  const totalProducts = cats.reduce((sum, c) => sum + c.count, 0);
  const minPrice = cats.length ? Math.min(...cats.map((c) => c.minPrice)) : null;
  const stats = [
    { icon: Boxes, label: 'Produtos', value: categories.isLoading ? '—' : String(totalProducts) },
    { icon: LayoutGrid, label: 'Categorias', value: categories.isLoading ? '—' : String(cats.length) },
    { icon: Tag, label: 'Preços a partir de', value: minPrice == null ? '—' : formatPrice(minPrice) },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <ProductsHeader
        companyName={company?.name}
        isAdmin={isAdmin}
        stats={stats}
        onAsk={() => navigate('/chat')}
        onCreate={() => openForm(null)}
      />

      {!isAdmin && (
        <div className="mb-5 flex items-center gap-2.5 rounded-2xl border border-accent-200 bg-accent-50 px-4 py-3 text-sm text-accent-600 dark:border-accent-500/20 dark:bg-accent-500/10 dark:text-accent-200">
          <Eye className="h-4 w-4 shrink-0" /> Modo visualização — apenas administradores podem cadastrar ou editar produtos.
        </div>
      )}

      <ProductFilters
        categories={cats}
        category={category}
        search={search}
        sort={sort}
        total={data?.total}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        onSortChange={(value) => {
          setSort(value);
          setPage(1);
        }}
        onCategoryChange={(value) => {
          setCategory(value);
          setPage(1);
        }}
      />

      <ProductCollection
        products={products}
        data={data}
        hasFilters={hasFilters}
        isAdmin={isAdmin}
        page={page}
        onPageChange={setPage}
        onClearFilters={() => {
          setSearch('');
          setCategory(undefined);
        }}
        onCreate={() => openForm(null)}
        onOpen={openDetails}
        onEdit={openForm}
        onDelete={setToDelete}
        onAsk={(product) =>
          navigate('/chat', {
            state: { ask: `Quero saber mais sobre o ${product.name}: destaques, para quem é ideal e o que combina com ele.`, productId: product.id },
          })
        }
      />

      <ProductDialogs
        isAdmin={isAdmin}
        viewingId={viewingId}
        initialProduct={data?.items.find((p) => p.id === viewingId)}
        formOpen={formOpen}
        editing={editing}
        categories={cats.map((c) => c.category)}
        toDelete={toDelete}
        isDeleting={deleteProduct.isPending}
        onCloseDetails={closeDetails}
        onEdit={(product) => {
          closeDetails();
          openForm(product);
        }}
        onDelete={(product) => {
          closeDetails();
          setToDelete(product);
        }}
        onCloseForm={() => setFormOpen(false)}
        onCloseDelete={() => setToDelete(null)}
        onConfirmDelete={confirmDelete}
      />
    </div>
  );
}

type ProductStat = {
  icon: typeof Boxes;
  label: string;
  value: string;
};

function ProductsHeader({
  companyName,
  isAdmin,
  stats,
  onAsk,
  onCreate,
}: Readonly<{
  companyName?: string;
  isAdmin: boolean;
  stats: ProductStat[];
  onAsk: () => void;
  onCreate: () => void;
}>) {
  return (
    <section className="bg-brand-hero relative mb-6 overflow-hidden rounded-[28px] p-6 text-white shadow-lift sm:p-8">
      <div className="bg-dots mask-radial pointer-events-none absolute inset-0 text-white/[0.07]" />
      <div className="pointer-events-none absolute -top-20 right-10 h-64 w-64 rounded-full bg-accent-500/20 blur-3xl" />
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-xl">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-accent-200 ring-1 ring-white/15 ring-inset">
            <Store className="h-3.5 w-3.5" /> {companyName}
          </p>
          <h1 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">Catálogo de produtos</h1>
          <p className="mt-2 text-sm leading-relaxed text-brand-100/80">
            {isAdmin
              ? 'Tudo o que você cadastra aqui fica disponível para o assistente de IA responder aos clientes.'
              : 'Explore os produtos ou peça uma recomendação ao assistente.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="glass" icon={<Sparkles className="h-4 w-4 text-accent-300" />} onClick={onAsk}>
            Perguntar ao assistente
          </Button>
          {isAdmin && (
            <Button variant="inverse" icon={<Plus className="h-4 w-4" />} onClick={onCreate}>
              Novo produto
            </Button>
          )}
        </div>
      </div>

      <dl className="relative mt-7 grid gap-3 sm:grid-cols-3">
        {stats.map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex items-center gap-3 rounded-2xl bg-white/[0.07] px-4 py-3 ring-1 ring-white/10 ring-inset backdrop-blur-sm">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10">
              <Icon className="h-4 w-4 text-accent-300" />
            </span>
            <div className="min-w-0">
              <dt className="text-[11px] font-medium tracking-wide text-brand-100/70 uppercase">{label}</dt>
              <dd className="truncate text-base font-bold tabular-nums">{value}</dd>
            </div>
          </div>
        ))}
      </dl>
    </section>
  );
}

function ProductFilters({
  categories,
  category,
  search,
  sort,
  total,
  onSearchChange,
  onSortChange,
  onCategoryChange,
}: Readonly<{
  categories: CategorySummary[];
  category?: string;
  search: string;
  sort: ProductSort;
  total?: number;
  onSearchChange: (value: string) => void;
  onSortChange: (value: ProductSort) => void;
  onCategoryChange: (value?: string) => void;
}>) {
  const allCategories: { category?: string; count?: number }[] = [{ category: undefined }, ...categories];

  return (
    <div className="sticky top-0 z-20 -mx-4 mb-6 space-y-2.5 border-b border-stone-200/70 bg-stone-50/85 px-4 py-2.5 sm:space-y-3 sm:py-3 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 dark:border-stone-800/70 dark:bg-stone-950/85">
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        {/* Search and sort share one row even on narrow phones. */}
        <div className="min-w-0 flex-1 basis-40 sm:max-w-md sm:basis-64">
          <Input
            type="search"
            placeholder="Buscar por nome, descrição ou categoria…"
            aria-label="Buscar produtos"
            icon={<Search />}
            className="rounded-full!"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <ArrowUpDown className="hidden h-4 w-4 text-stone-400 sm:block" />
          <Select
            aria-label="Ordenar por"
            className="w-auto! rounded-full! pl-4"
            value={sort}
            onChange={(event) => onSortChange(event.target.value as ProductSort)}
          >
            <option value="newest">Mais recentes</option>
            <option value="name">Nome (A–Z)</option>
            <option value="price_asc">Menor preço</option>
            <option value="price_desc">Maior preço</option>
          </Select>
        </div>
        {total != null && (
          <p className="ml-auto hidden text-sm text-stone-500 md:block dark:text-stone-400">
            <strong className="font-semibold text-stone-800 dark:text-stone-200">{total}</strong> {total === 1 ? 'produto' : 'produtos'}
          </p>
        )}
      </div>
      <div className="no-scrollbar -mx-4 -my-1 flex gap-2 overflow-x-auto px-4 py-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        {allCategories.map((item) => (
          <CategoryFilter
            key={item.category ?? '__all'}
            category={item.category}
            count={item.count}
            active={category === item.category}
            onSelect={onCategoryChange}
          />
        ))}
      </div>
    </div>
  );
}

function CategoryFilter({
  category,
  count,
  active,
  onSelect,
}: Readonly<{
  category?: string;
  count?: number;
  active: boolean;
  onSelect: (category?: string) => void;
}>) {
  return (
    <button
      type="button"
      onClick={() => onSelect(category)}
      className={clsx(
        'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition',
        active
          ? 'bg-brand-600 text-white shadow-sm shadow-brand-900/30 dark:bg-brand-500'
          : 'bg-white text-stone-600 ring-1 ring-stone-200 hover:text-stone-900 hover:ring-stone-300 dark:bg-stone-900 dark:text-stone-300 dark:ring-stone-700 dark:hover:ring-stone-600',
      )}
    >
      {category ?? 'Todas'}
      {count != null && (
        <span
          className={clsx(
            'rounded-full px-1.5 text-[11px] tabular-nums',
            active ? 'bg-white/20' : 'bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400',
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

type ProductsQuery = ReturnType<typeof useProducts>;

function ProductCollection({
  products,
  data,
  hasFilters,
  isAdmin,
  page,
  onPageChange,
  onClearFilters,
  onCreate,
  onOpen,
  onEdit,
  onDelete,
  onAsk,
}: Readonly<{
  products: ProductsQuery;
  data: Paginated<Product> | undefined;
  hasFilters: boolean;
  isAdmin: boolean;
  page: number;
  onPageChange: (page: number | ((currentPage: number) => number)) => void;
  onClearFilters: () => void;
  onCreate: () => void;
  onOpen: (product: Product) => void;
  onEdit: (product: Product | null) => void;
  onDelete: (product: Product) => void;
  onAsk: (product: Product) => void;
}>) {
  if (products.isLoading) return <ProductLoadingState />;
  if (products.isError) return <ProductErrorState products={products} />;
  if (!data?.items.length) {
    return (
      <ProductEmptyState
        hasFilters={hasFilters}
        isAdmin={isAdmin}
        onClearFilters={onClearFilters}
        onCreate={onCreate}
      />
    );
  }

  return (
    <>
      <div className={clsx('grid grid-cols-1 gap-5 transition-opacity sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4', products.isPlaceholderData && 'opacity-60')}>
        {data.items.map((product, index) => (
          <ProductCard
            key={product.id}
            priority={index < 8}
            product={product}
            canEdit={isAdmin}
            onOpen={() => onOpen(product)}
            onEdit={() => onEdit(product)}
            onDelete={() => onDelete(product)}
            onAsk={() => onAsk(product)}
          />
        ))}
      </div>
      {data.totalPages > 1 && (
        <ProductPagination
          totalPages={data.totalPages}
          currentPage={data.page}
          page={page}
          onPageChange={onPageChange}
        />
      )}
    </>
  );
}

function ProductLoadingState() {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }, (_, index) => <ProductCardSkeleton key={index} />)}
    </div>
  );
}

function ProductErrorState({ products }: Readonly<{ products: ProductsQuery }>) {
  return (
    <EmptyState
      icon={<PackageSearch className="h-7 w-7" />}
      title="Não foi possível carregar os produtos"
      description={products.error instanceof ApiError ? products.error.message : undefined}
      action={<Button variant="secondary" onClick={() => products.refetch()}>Tentar novamente</Button>}
    />
  );
}

function ProductEmptyState({
  hasFilters,
  isAdmin,
  onClearFilters,
  onCreate,
}: Readonly<{
  hasFilters: boolean;
  isAdmin: boolean;
  onClearFilters: () => void;
  onCreate: () => void;
}>) {
  const title = hasFilters ? 'Nenhum produto encontrado' : 'Seu catálogo está vazio';
  const description = getEmptyDescription(hasFilters, isAdmin);
  const action = getEmptyAction(hasFilters, isAdmin, onClearFilters, onCreate);

  return (
    <EmptyState
      icon={<PackageSearch className="h-7 w-7" />}
      title={title}
      description={description}
      action={action}
    />
  );
}

function getEmptyDescription(hasFilters: boolean, isAdmin: boolean) {
  if (hasFilters) return 'Tente outros termos ou limpe os filtros.';
  return isAdmin ? 'Cadastre o primeiro produto para começar.' : 'Peça a um administrador para cadastrar produtos.';
}

function getEmptyAction(
  hasFilters: boolean,
  isAdmin: boolean,
  onClearFilters: () => void,
  onCreate: () => void,
) {
  if (hasFilters) return <Button variant="secondary" onClick={onClearFilters}>Limpar filtros</Button>;
  if (isAdmin) return <Button icon={<Plus className="h-4 w-4" />} onClick={onCreate}>Novo produto</Button>;
  return undefined;
}

function ProductPagination({
  totalPages,
  currentPage,
  page,
  onPageChange,
}: Readonly<{
  totalPages: number;
  currentPage: number;
  page: number;
  onPageChange: (page: number | ((currentPage: number) => number)) => void;
}>) {
  const visiblePages = Array.from({ length: totalPages }, (_, index) => index + 1)
    .filter((number) => number === 1 || number === totalPages || Math.abs(number - currentPage) <= 1);

  return (
    <nav className="mt-10 flex items-center justify-center gap-1.5" aria-label="Paginação">
      <Button variant="secondary" size="icon" aria-label="Página anterior" disabled={page <= 1} onClick={() => onPageChange((current) => current - 1)} icon={<ChevronLeft className="h-4 w-4" />} />
      {visiblePages.map((number, index) => (
        <span key={number} className="flex items-center gap-1.5">
          {hasPageGap(visiblePages, index) && <span className="px-1 text-stone-400">…</span>}
          <button
            type="button"
            onClick={() => onPageChange(number)}
            aria-current={number === currentPage ? 'page' : undefined}
            className={clsx(
              'h-9 min-w-9 rounded-xl px-2 text-sm font-semibold tabular-nums transition',
              number === currentPage
                ? 'bg-brand-600 text-white shadow-glow dark:bg-brand-500'
                : 'text-stone-600 hover:bg-white hover:shadow-card dark:text-stone-400 dark:hover:bg-stone-900',
            )}
          >
            {number}
          </button>
        </span>
      ))}
      <Button variant="secondary" size="icon" aria-label="Próxima página" disabled={page >= totalPages} onClick={() => onPageChange((current) => current + 1)} icon={<ChevronRight className="h-4 w-4" />} />
    </nav>
  );
}

function hasPageGap(pages: number[], index: number) {
  return index > 0 && pages[index]! - pages[index - 1]! > 1;
}

function ProductDialogs({
  isAdmin,
  viewingId,
  initialProduct,
  formOpen,
  editing,
  categories,
  toDelete,
  isDeleting,
  onCloseDetails,
  onEdit,
  onDelete,
  onCloseForm,
  onCloseDelete,
  onConfirmDelete,
}: Readonly<{
  isAdmin: boolean;
  viewingId: string | null;
  initialProduct?: Product;
  formOpen: boolean;
  editing: Product | null;
  categories: string[];
  toDelete: Product | null;
  isDeleting: boolean;
  onCloseDetails: () => void;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  onCloseForm: () => void;
  onCloseDelete: () => void;
  onConfirmDelete: () => void;
}>) {
  return (
    <>
      <ProductDetailsModal
        productId={viewingId}
        initial={initialProduct}
        canEdit={isAdmin}
        onClose={onCloseDetails}
        onEdit={onEdit}
        onDelete={onDelete}
      />
      {isAdmin && (
        <>
          <ProductFormModal
            open={formOpen}
            product={editing}
            categories={categories}
            onClose={onCloseForm}
          />
          <Modal
            open={!!toDelete}
            onClose={onCloseDelete}
            size="sm"
            title="Excluir produto?"
            icon={<Trash2 className="h-5 w-5 text-red-600 dark:text-red-400" />}
            footer={
              <>
                <Button variant="secondary" onClick={onCloseDelete}>Cancelar</Button>
                <Button variant="danger" loading={isDeleting} onClick={onConfirmDelete}>Excluir</Button>
              </>
            }
          >
            <p className="text-sm text-stone-600 dark:text-stone-400">
              <strong className="text-stone-900 dark:text-stone-100">{toDelete?.name}</strong> será removido do catálogo e o assistente de IA
              deixará de oferecê-lo. Essa ação não pode ser desfeita.
            </p>
          </Modal>
        </>
      )}
    </>
  );
}
