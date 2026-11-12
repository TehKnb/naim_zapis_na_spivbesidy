'use client';

import { CalendarCheck2, Eye, EyeOff, Info, LockKeyhole, UserRound } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Button, cx } from '@/components/ui';

/** Лише відносний шлях цього сайту (дублює safeNextPath з lib/auth, щоб не тягнути серверний код у браузер). */
function safeNext(raw: string | null) {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\') || raw.startsWith('/login') || raw.startsWith('/api/')) return '/';
  return raw;
}

function LoginForm() {
  const next = safeNext(useSearchParams().get('next'));
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    if (!login.trim() || !password) { setError('Вкажіть логін і пароль.'); return; }
    setPending(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login, password }),
        cache: 'no-store',
      });
      if (res.ok) {
        // Повне перезавантаження: чистий стан застосунку вже з cookie сесії
        window.location.replace(next);
        return;
      }
      const body = await res.json().catch(() => null);
      setError(body?.error?.message || 'Не вдалося увійти. Спробуйте ще раз.');
      setPassword('');
    } catch {
      setError("Немає зв'язку із сервером. Перевірте інтернет-з'єднання.");
    }
    setPending(false);
  }

  const field = 'h-11 w-full rounded-lg border border-line-strong bg-surface pl-10 text-[15px] text-ink outline-none transition placeholder:text-ink-soft focus:border-primary focus:ring-4 focus:ring-primary/15 disabled:bg-neutral-50';

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {error && (
        <div className="flex gap-2 rounded-lg border border-danger/20 bg-danger-50 px-3 py-2.5 text-sm text-danger-700" role="alert">
          <Info className="mt-0.5 h-4 w-4 flex-none" /> {error}
        </div>
      )}
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-ink">Логін</span>
        <span className="relative block">
          <UserRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
          <input value={login} onChange={(e) => setLogin(e.target.value)} disabled={pending} autoFocus
            name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} className={cx(field, 'pr-3')} />
        </span>
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-ink">Пароль</span>
        <span className="relative block">
          <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
          <input type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} disabled={pending}
            name="password" autoComplete="current-password" className={cx(field, 'pr-11')} />
          <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? 'Приховати пароль' : 'Показати пароль'}
            className="absolute right-1.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-ink-soft hover:bg-neutral-100 hover:text-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20">
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </span>
      </label>
      <Button type="submit" loading={pending} className="h-11 w-full text-[15px]">Увійти</Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-[calc(100vh-3rem)] items-center justify-center py-8 md:min-h-[calc(100vh-4rem)]">
      <div className="w-full max-w-[400px]">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-white shadow-lift">
            <CalendarCheck2 className="h-7 w-7" strokeWidth={2.2} />
          </span>
          <h1 className="mt-4 text-[26px] font-bold tracking-tight text-ink">Вхід в адмінпанель</h1>
          <p className="mt-1 text-sm text-ink-muted">Групові співбесіди · KeyCRM</p>
        </div>
        <div className="relative overflow-hidden rounded-card border border-line bg-surface p-6 shadow-card sm:p-7">
          <span className="absolute inset-x-0 top-0 h-1 bg-brand-x" aria-hidden />
          <Suspense fallback={<div className="h-[248px]" />}>
            <LoginForm />
          </Suspense>
        </div>
        <p className="mt-5 text-center text-xs text-ink-muted">Спільний доступ для команди. Після входу сесія діє 30 днів.</p>
      </div>
    </div>
  );
}
