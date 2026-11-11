'use client';

import { CalendarCheck2, LayoutDashboard, List, Menu, Plus, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useSessionForm } from './session-form';
import { Button, cx } from './ui';

const NAV = [
  { href: '/', label: 'Огляд', icon: LayoutDashboard },
  { href: '/sessions', label: 'Усі співбесіди', icon: List },
];

function isActive(path: string, href: string) {
  return href === '/' ? path === '/' : path === href || path.startsWith(href + '/');
}

export function Navbar() {
  const path = usePathname();
  const { openCreate } = useSessionForm();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/95 shadow-xs backdrop-blur supports-[backdrop-filter]:bg-surface/85">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 md:h-16 md:px-6 lg:px-8">
        {/* Ліва частина */}
        <Link href="/" className="flex min-w-0 items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20">
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-brand text-white shadow-xs">
            <CalendarCheck2 className="h-[18px] w-[18px]" strokeWidth={2.2} />
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-[15px] font-bold tracking-tight text-ink">Співбесіди</span>
            <span className="hidden truncate text-xs text-ink-muted sm:block">Групові · KeyCRM</span>
          </span>
        </Link>

        {/* Центральна частина */}
        <nav className="mx-auto hidden h-full items-center gap-6 md:flex" aria-label="Основна навігація">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = isActive(path, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cx(
                  'relative flex h-full items-center gap-2 text-[15px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20',
                  active ? 'text-primary' : 'text-ink-muted hover:text-ink',
                )}
              >
                <Icon className="h-[18px] w-[18px]" aria-hidden />
                {label}
                {/* Синя смужка під активним пунктом, як у вкладок Calendly */}
                {active && <span className="absolute inset-x-0 -bottom-px h-[3px] rounded-t-full bg-primary" aria-hidden />}
              </Link>
            );
          })}
        </nav>

        {/* Права частина */}
        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <Button onClick={openCreate} className="hidden md:inline-flex md:px-3 lg:px-4" aria-label="Створити співбесіду">
            <Plus className="h-4 w-4" strokeWidth={2.4} />
            <span className="md:hidden lg:inline">Створити співбесіду</span>
            <span className="hidden md:inline lg:hidden">Створити</span>
          </Button>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 md:hidden"
            aria-label={open ? 'Закрити меню' : 'Відкрити меню'}
            aria-expanded={open}
            aria-controls="mobile-menu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Мобільне меню (бургер) */}
      {open && (
        <div id="mobile-menu" className="border-t border-line bg-surface px-4 pb-4 pt-2 md:hidden">
          <nav className="flex flex-col gap-1" aria-label="Мобільна навігація">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = isActive(path, href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={cx('flex h-11 items-center gap-3 rounded-lg px-3 text-[15px] font-medium', active ? 'bg-primary-50 text-primary' : 'text-ink hover:bg-neutral-100')}
                >
                  <Icon className="h-[18px] w-[18px]" aria-hidden />
                  {label}
                </Link>
              );
            })}
          </nav>
          <Button onClick={() => { setOpen(false); openCreate(); }} className="mt-3 w-full">
            <Plus className="h-4 w-4" strokeWidth={2.4} /> Створити співбесіду
          </Button>
        </div>
      )}
    </header>
  );
}
