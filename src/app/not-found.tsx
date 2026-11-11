import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center py-24 text-center">
      <p className="text-sm font-medium text-primary">404</p>
      <h1 className="mt-2 text-2xl font-semibold text-ink">Сторінку не знайдено</h1>
      <Link href="/" className="mt-6 text-sm font-medium text-primary hover:underline">Повернутися до огляду</Link>
    </div>
  );
}
