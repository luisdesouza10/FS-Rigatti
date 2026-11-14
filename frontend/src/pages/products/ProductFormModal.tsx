import { zodResolver } from '@hookform/resolvers/zod';
import { Link2, PackagePlus, Pencil, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '../../components/ui/Button';
import { Field, Input, Textarea } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { uploadImage, useSaveProduct } from '../../hooks/useProducts';
import { ApiError } from '../../lib/api';
import type { Product } from '../../lib/types';
import { ProductImage } from './ProductCard';

const schema = z.object({
  name: z.string().trim().min(2, 'Nome muito curto').max(120),
  category: z.string().trim().min(2, 'Informe a categoria').max(60),
  price: z.number({ error: 'Informe o preço' }).min(0, 'Preço inválido').max(10_000_000),
  description: z.string().trim().max(2000, 'Máximo de 2000 caracteres'),
  imageUrl: z
    .string()
    .trim()
    .refine((v) => v === '' || /^https:\/\//i.test(v) || v.startsWith('/uploads/'), 'Use uma URL https ou envie uma imagem'),
});
type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = { name: '', category: '', price: 0, description: '', imageUrl: '' };

interface Props {
  open: boolean;
  product: Product | null;
  categories: string[];
  onClose: () => void;
}

export function ProductFormModal({ open, product, categories, onClose }: Readonly<Props>) {
  const save = useSaveProduct();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    setError,
    watch,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: EMPTY });

  useEffect(() => {
    if (open) reset(product ? { ...product } : EMPTY);
  }, [open, product, reset]);

  const imageUrl = watch('imageUrl');

  const onFile = async (file?: File) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return toast.error('A imagem deve ter no máximo 2 MB');
    setUploading(true);
    try {
      const { url } = await uploadImage(file);
      setValue('imageUrl', url, { shouldValidate: true, shouldDirty: true });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Falha no upload');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const onSubmit = handleSubmit(async (data) => {
    try {
      await save.mutateAsync({ id: product?.id, data });
      toast.success(product ? 'Produto atualizado' : 'Produto criado');
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.details) {
        for (const d of err.details) setError(d.field as keyof FormValues, { message: d.message });
      } else {
        toast.error(err instanceof ApiError ? err.message : 'Não foi possível salvar');
      }
    }
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={product ? 'Editar produto' : 'Novo produto'}
      description="Essas informações ficam disponíveis para o assistente de IA."
      icon={product ? <Pencil className="h-5 w-5" /> : <PackagePlus className="h-5 w-5" />}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="product-form" loading={save.isPending} disabled={uploading}>
            {product ? 'Salvar alterações' : 'Criar produto'}
          </Button>
        </>
      }
    >
      <form id="product-form" onSubmit={onSubmit} noValidate className="grid gap-5 sm:grid-cols-[1fr_200px]">
        <div className="space-y-4">
          <Field label="Nome" htmlFor="name" error={errors.name?.message}>
            <Input id="name" invalid={!!errors.name} placeholder="Ex.: Notebook UltraBook Pro" {...register('name')} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Categoria" htmlFor="category" error={errors.category?.message}>
              <Input id="category" list="category-options" invalid={!!errors.category} placeholder="Ex.: Notebooks" {...register('category')} />
              <datalist id="category-options">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>
            <Field label="Preço (R$)" htmlFor="price" error={errors.price?.message}>
              <Input
                id="price"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                invalid={!!errors.price}
                {...register('price', { valueAsNumber: true })}
              />
            </Field>
          </div>
          <Field label="Descrição" htmlFor="description" error={errors.description?.message} hint="Quanto mais detalhes, melhores as respostas da IA.">
            <Textarea id="description" rows={5} invalid={!!errors.description} placeholder="Características, materiais, medidas…" {...register('description')} />
          </Field>
        </div>

        <div className="space-y-3">
          <span className="block text-sm font-semibold text-stone-700 dark:text-stone-300">Imagem</span>
          <div className="aspect-square overflow-hidden rounded-2xl border-2 border-dashed border-stone-200 bg-stone-50 dark:border-stone-700 dark:bg-stone-800/40">
            <ProductImage key={imageUrl} src={imageUrl} alt="Pré-visualização" />
          </div>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          <Button variant="secondary" size="sm" className="w-full" loading={uploading} icon={<Upload className="h-3.5 w-3.5" />} onClick={() => fileRef.current?.click()}>
            Enviar imagem
          </Button>
          <div className="relative">
            <Link2 className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-stone-400" />
            <Input aria-label="URL da imagem" placeholder="ou cole uma URL" className="!h-9 pl-8 text-xs" invalid={!!errors.imageUrl} {...register('imageUrl')} />
          </div>
          {errors.imageUrl && <p className="text-xs text-red-600 dark:text-red-400">{errors.imageUrl.message}</p>}
        </div>
      </form>
    </Modal>
  );
}
