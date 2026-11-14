import { Building2, Check, PackageSearch, ShieldCheck, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import { ThemeToggle } from '../../components/layout/ThemeToggle';
import { Logo } from '../../components/ui/misc';

const img = (id: string, size = 320) => `https://images.unsplash.com/photo-${id}?w=${size}&h=${size}&q=70&auto=format&fit=crop`;

const FEATURES = [
  { icon: Sparkles, title: 'IA que conhece o catálogo', text: 'Respostas com preço, categoria e detalhes reais.' },
  { icon: Building2, title: 'Multiempresa', text: 'Cada empresa com seus produtos e sua equipe.' },
  { icon: ShieldCheck, title: 'Dados isolados', text: 'Ninguém vê o catálogo de outra empresa.' },
];

/** Static illustration of the assistant answering from the catalog. */
function ChatPreview() {
  return (
    <div className="relative mx-auto w-full max-w-[420px]">
      {/* Floating product photos behind the card */}
      <img
        src={img('1505740420928-5e560c06d30e')}
        alt=""
        className="absolute -top-10 -right-6 h-28 w-28 rotate-6 animate-float-slow rounded-2xl object-cover shadow-2xl ring-4 ring-white/10"
      />
      <img
        src={img('1507473885765-e6ed057f782c')}
        alt=""
        className="absolute -bottom-8 -left-10 h-24 w-24 -rotate-6 animate-float rounded-2xl object-cover shadow-2xl ring-4 ring-white/10"
      />

      <div className="relative rounded-3xl bg-white/95 p-4 text-stone-900 shadow-2xl shadow-black/30 ring-1 ring-white/40 backdrop-blur dark:bg-stone-900/95 dark:text-stone-100 dark:ring-white/10">
        <div className="flex items-center gap-2.5 border-b border-stone-100 pb-3 dark:border-stone-800">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-800 text-white">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-bold">Assistente da loja</p>
            <p className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> online
            </p>
          </div>
        </div>

        <div className="space-y-2.5 pt-3 text-[13px]">
          <div className="ml-auto w-fit max-w-[80%] rounded-2xl rounded-br-md bg-brand-600 px-3.5 py-2 text-white">
            Tem fone com cancelamento de ruído até R$ 800?
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-2.5 py-1 text-[11px] text-stone-600 dark:bg-stone-800 dark:text-stone-300">
            <PackageSearch className="h-3 w-3" /> Buscou no catálogo
            <Check className="h-3 w-3 text-emerald-500" /> 2 resultados
          </div>
          <p className="leading-relaxed text-stone-700 dark:text-stone-300">
            Sim! O <strong className="text-brand-700 underline decoration-brand-300 underline-offset-2 dark:text-brand-300">Fone Wave ANC</strong> sai
            por <strong>R$ 749,90</strong> e tem 30h de bateria.
          </p>
          <div className="flex items-center gap-2.5 rounded-2xl border border-stone-200 p-1.5 pr-3 dark:border-stone-700">
            <img src={img('1505740420928-5e560c06d30e', 96)} alt="" className="h-10 w-10 rounded-xl object-cover" />
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-xs font-semibold">Fone Wave ANC</p>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">Áudio</p>
            </div>
            <p className="text-sm font-extrabold">R$ 749,90</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AuthLayout({ title, subtitle, children }: Readonly<{ title: string; subtitle: ReactNode; children: ReactNode }>) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <section className="bg-brand-hero relative hidden overflow-hidden text-white lg:flex">
        <div className="bg-dots mask-radial pointer-events-none absolute inset-0 text-white/[0.08]" />
        <div className="pointer-events-none absolute -top-32 -left-24 h-96 w-96 rounded-full bg-brand-400/25 blur-3xl" />
        <div className="pointer-events-none absolute -right-24 -bottom-40 h-[28rem] w-[28rem] rounded-full bg-accent-500/15 blur-3xl" />

        <div className="relative flex w-full flex-col justify-between p-12 xl:p-16">
          <Logo inverted />

          <div className="grid items-center gap-14 py-12 xl:gap-16">
            <div className="max-w-lg">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-accent-200 ring-1 ring-white/15 ring-inset">
                <Sparkles className="h-3.5 w-3.5" /> Catálogo + assistente de IA
              </span>
              <h2 className="mt-5 font-display text-4xl leading-[1.08] font-bold tracking-tight xl:text-5xl">
                Seu catálogo inteiro,{' '}
                <span className="bg-gradient-to-r from-accent-200 to-accent-400 bg-clip-text text-transparent">respondendo por você.</span>
              </h2>
              <p className="mt-4 max-w-md text-[15px] leading-relaxed text-brand-100/80">
                Cadastre seus produtos e deixe que os clientes perguntem. O assistente responde só com o que está na sua vitrine.
              </p>
            </div>
            <ChatPreview />
          </div>

          <div className="grid grid-cols-3 gap-6 border-t border-white/10 pt-8">
            {FEATURES.map(({ icon: Icon, title: t, text }) => (
              <div key={t}>
                <Icon className="h-5 w-5 text-accent-300" />
                <p className="mt-2.5 text-sm font-semibold">{t}</p>
                <p className="mt-1 text-xs leading-relaxed text-brand-100/65">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative flex flex-col overflow-hidden px-4 py-6 sm:px-10">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-brand-100/60 to-transparent lg:hidden dark:from-brand-900/30" />
        <div className="relative flex items-center justify-between">
          <Logo className="lg:invisible" />
          <ThemeToggle />
        </div>
        <div className="relative mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-12">
          <h1 className="font-display text-3xl font-bold tracking-tight">{title}</h1>
          <p className="mt-2 mb-8 text-sm text-stone-500 dark:text-stone-400">{subtitle}</p>
          {children}
        </div>
        <p className="relative text-center text-xs text-stone-400">© {new Date().getFullYear()} Vitrine IA</p>
      </section>
    </div>
  );
}
