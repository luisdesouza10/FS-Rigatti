import { ArrowUp, Square } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '../../components/ui/Button';

interface ComposerProps {
  streaming: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
  autoFocusKey?: unknown;
}

export function Composer({ streaming, onSend, onStop, autoFocusKey }: Readonly<ComposerProps>) {
  const [value, setValue] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => ref.current?.focus(), [autoFocusKey]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [value]);

  const submit = () => {
    const text = value.trim();
    if (!text || streaming) return;
    onSend(text);
    setValue('');
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex items-end gap-2 rounded-[22px] border border-stone-200 bg-white p-2 pl-3 shadow-lift transition focus-within:border-brand-400 focus-within:ring-4 focus-within:ring-brand-500/10 dark:border-stone-700 dark:bg-stone-900 dark:focus-within:border-brand-400"
    >
      <textarea
        ref={ref}
        rows={1}
        value={value}
        maxLength={2000}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder="Pergunte sobre produtos, preços, recomendações…"
        aria-label="Mensagem"
        className="scroll-thin max-h-[180px] min-h-[40px] flex-1 resize-none bg-transparent px-2.5 py-2 text-sm placeholder:text-stone-400 focus:outline-none"
      />
      {streaming ? (
        <Button type="button" variant="secondary" size="icon" className="h-10 w-10 rounded-2xl" aria-label="Parar resposta" onClick={onStop} icon={<Square className="h-3.5 w-3.5 fill-current" />} />
      ) : (
        <Button type="submit" size="icon" className="h-10 w-10 rounded-2xl" aria-label="Enviar" disabled={!value.trim()} icon={<ArrowUp className="h-4 w-4" />} />
      )}
    </form>
  );
}
