import clsx from 'clsx';
import { ArrowRight, KeyRound, LogOut, Menu, MessageCircle, Package, Sparkles, Users, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/Button';
import { Avatar, Logo } from '../ui/misc';
import { ChangePasswordModal } from './ChangePasswordModal';
import { ThemeToggle } from './ThemeToggle';

/** Lets full-height pages (which hide the mobile top bar) open the mobile menu from their own header. */
export type AppLayoutContext = { openMenu: () => void };

// Pages that manage their own full-height layout and header on mobile.
const FULL_HEIGHT_ROUTES = ['/chat'];

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setMobileOpen(false), [location.pathname]);
  const fullHeight = FULL_HEIGHT_ROUTES.includes(location.pathname);

  return (
    <div className="flex h-dvh overflow-hidden">
      <aside className="hidden w-[272px] shrink-0 border-r border-stone-200/80 bg-white lg:flex dark:border-stone-800 dark:bg-stone-900">
        <SidebarContent />
      </aside>

      {/* Always mounted so closing can animate too; `inert` keeps it out of focus/AT while hidden. */}
      <div
        className={clsx(
          // visibility flips to hidden only after the slide-out finishes (no shadow peeking at the edge)
          'fixed inset-0 z-40 transition-[visibility] duration-[280ms] lg:hidden',
          !mobileOpen && 'pointer-events-none invisible',
        )}
        inert={!mobileOpen}
      >
        <button
          type="button"
          aria-label="Fechar menu"
          tabIndex={-1}
          className={clsx(
            'absolute inset-0 cursor-default bg-stone-950/45 backdrop-blur-sm transition-opacity duration-200 ease-out',
            mobileOpen ? 'opacity-100' : 'opacity-0',
          )}
          onClick={() => setMobileOpen(false)}
        />
        <aside
          className={clsx(
            'absolute inset-y-0 left-0 flex w-[290px] max-w-[85vw] bg-white shadow-2xl transition-transform duration-[280ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] dark:bg-stone-900',
            mobileOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <SidebarContent onClose={() => setMobileOpen(false)} />
        </aside>
      </div>

      {/* The mobile top bar lives inside the scroll area so it scrolls away, leaving room for the content. */}
      <main className="relative min-w-0 flex-1 overflow-y-auto">
        {!fullHeight && (
          <header className="flex h-14 items-center justify-between border-b border-stone-200/80 bg-white/80 px-4 lg:hidden dark:border-stone-800 dark:bg-stone-900/80">
            <Logo />
            <Button variant="ghost" size="icon" aria-label="Abrir menu" onClick={() => setMobileOpen(true)} icon={<Menu className="h-5 w-5" />} />
          </header>
        )}
        <Outlet context={{ openMenu: () => setMobileOpen(true) } satisfies AppLayoutContext} />
      </main>
    </div>
  );
}

function SidebarContent({ onClose }: Readonly<{ onClose?: () => void }>) {
  const { user, company, isAdmin, logout } = useAuth();
  const { pathname } = useLocation();
  const [passwordOpen, setPasswordOpen] = useState(false);

  const nav = [
    { to: '/products', label: 'Produtos', icon: Package },
    { to: '/chat', label: 'Assistente', icon: MessageCircle, badge: 'IA' },
    ...(isAdmin ? [{ to: '/team', label: 'Equipe', icon: Users }] : []),
  ];

  return (
    <div className="flex w-full flex-col">
      <div className="flex h-[72px] items-center justify-between px-5">
        <Logo />
        {onClose && <Button variant="ghost" size="icon" aria-label="Fechar menu" onClick={onClose} icon={<X className="h-5 w-5" />} />}
      </div>

      <div className="mx-4 mb-5 flex items-center gap-3 rounded-2xl border border-stone-200/80 bg-stone-50 p-3 dark:border-stone-800 dark:bg-stone-950/40">
        <Avatar name={company?.name ?? '?'} className="rounded-xl! ring-0" />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">{company?.name}</p>
          <p className="text-xs text-stone-500 dark:text-stone-400">{isAdmin ? 'Administrador' : 'Cliente'}</p>
        </div>
      </div>

      <p className="px-6 pb-2 text-[11px] font-semibold tracking-wider text-stone-400 uppercase">Menu</p>
      <nav aria-label="Principal" className="space-y-1 px-3">
        {nav.map(({ to, label, icon: Icon, badge }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              clsx(
                'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition',
                isActive
                  ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200'
                  : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100',
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && <span className="absolute top-2 bottom-2 -left-3 w-1 rounded-r-full bg-brand-600 dark:bg-brand-400" />}
                <span
                  className={clsx(
                    'flex h-8 w-8 items-center justify-center rounded-lg transition',
                    isActive
                      ? 'bg-brand-600 text-white shadow-glow dark:bg-brand-500'
                      : 'bg-stone-100 text-stone-500 group-hover:bg-white group-hover:text-stone-700 dark:bg-stone-800 dark:text-stone-400 dark:group-hover:bg-stone-700',
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="flex-1">{label}</span>
                {badge && <span className="rounded-md bg-accent-100 px-1.5 py-0.5 text-[10px] font-bold text-accent-600 dark:bg-accent-500/15 dark:text-accent-300">{badge}</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="flex-1" />

      {pathname !== '/chat' && (
        <Link
          to="/chat"
          className="bg-brand-hero group relative mx-4 mb-4 overflow-hidden rounded-2xl p-4 text-white shadow-lift"
        >
          <div className="bg-dots pointer-events-none absolute inset-0 text-white/10" />
          <div className="relative">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/20">
              <Sparkles className="h-4 w-4 text-accent-300" />
            </span>
            <p className="mt-3 text-sm font-bold">Pergunte ao assistente</p>
            <p className="mt-0.5 text-xs leading-relaxed text-brand-100/75">Recomendações e comparações com base no catálogo.</p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-accent-200">
              Abrir chat <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
            </span>
          </div>
        </Link>
      )}

      <div className="space-y-3 border-t border-stone-200/80 p-4 dark:border-stone-800">
        <div className="flex items-center gap-3">
          <Avatar name={user?.name ?? '?'} size="sm" />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-semibold">{user?.name}</p>
            <p className="truncate text-xs text-stone-500 dark:text-stone-400">{user?.email}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Alterar senha"
            title="Alterar senha"
            onClick={() => setPasswordOpen(true)}
            icon={<KeyRound className="h-4 w-4" />}
          />
          <Button variant="ghost" size="icon" aria-label="Sair" title="Sair" onClick={logout} icon={<LogOut className="h-4 w-4" />} />
        </div>
        <ThemeToggle className="w-full" showLabels />
      </div>
      <ChangePasswordModal open={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </div>
  );
}
