'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { Toaster } from 'sonner';
import { ClientApiError } from '@/lib/api-client';
import { SessionFormProvider } from '@/components/session-form';

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: true,
            retry: (count, err) => !(err instanceof ClientApiError && err.status >= 400 && err.status < 500) && count < 2,
          },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <SessionFormProvider>{children}</SessionFormProvider>
      <Toaster
        position="top-right"
        toastOptions={{
          classNames: {
            toast: '!rounded-card !border !border-line !bg-surface !text-ink !shadow-pop !font-sans',
            description: '!text-ink-muted',
          },
        }}
      />
    </QueryClientProvider>
  );
}
