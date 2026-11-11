'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { Session, SessionDetails, SessionInput } from '@/lib/types';

export const keys = {
  sessions: ['sessions'] as const,
  pipelines: ['pipelines'] as const,
  responsibles: ['responsibles'] as const,
  session: (id: string) => ['session', id] as const,
};

/** Один спільний кеш для «Огляду» і «Усіх співбесід» — оновлення узгоджене на всіх вкладках. */
export function useSessions() {
  return useQuery({ queryKey: keys.sessions, queryFn: async () => (await api.list()).sessions });
}

/** Довідник воронок (форма, фільтри). Змінюється рідко — у n8n, вузол «Конфіг». */
export function usePipelines() {
  return useQuery({ queryKey: keys.pipelines, queryFn: async () => (await api.pipelines()).pipelines, staleTime: 5 * 60_000 });
}

/** Співробітники, яких можна призначити відповідальними (n8n таблиця Interview Responsibles). */
export function useResponsibles() {
  return useQuery({ queryKey: keys.responsibles, queryFn: async () => (await api.responsibles()).responsibles, staleTime: 5 * 60_000 });
}

export function useSession(id: string) {
  return useQuery({ queryKey: keys.session(id), queryFn: () => api.get(id), enabled: !!id });
}

function useSyncSession() {
  const qc = useQueryClient();
  return (session: Session) => {
    qc.setQueryData<Session[]>(keys.sessions, (old) => {
      if (!old) return old;
      const exists = old.some((s) => s.id === session.id);
      return exists ? old.map((s) => (s.id === session.id ? session : s)) : [...old, session];
    });
    qc.setQueryData<SessionDetails>(keys.session(session.id), (old) => (old ? { ...old, session } : old));
    qc.invalidateQueries({ queryKey: keys.sessions });
    qc.invalidateQueries({ queryKey: keys.session(session.id) });
  };
}

export function useCreateSession() {
  const sync = useSyncSession();
  return useMutation({
    mutationFn: (input: SessionInput) => api.create(input),
    onSuccess: ({ session }) => sync(session),
  });
}

export function useUpdateSession(id: string) {
  const sync = useSyncSession();
  return useMutation({
    mutationFn: (input: SessionInput) => api.update(id, input),
    onSuccess: ({ session }) => sync(session),
  });
}

export function useCloseSession(id: string) {
  const sync = useSyncSession();
  return useMutation({
    mutationFn: () => api.close(id),
    onSuccess: ({ session }) => sync(session),
  });
}
