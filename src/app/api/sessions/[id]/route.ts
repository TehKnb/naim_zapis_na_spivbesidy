import { NextResponse } from 'next/server';
import { guarded, parseSessionInput, readJson, sessionIdParam } from '@/lib/server-route';
import { getSession, updateSession } from '@/lib/sessions-service';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };

/** Деталі співбесіди + кандидати. */
export function GET(_req: Request, { params }: Ctx) {
  return guarded(async () => NextResponse.json(await getSession(sessionIdParam((await params).id))));
}

/** Редагування дати, часу, максимальної кількості учасників, воронки й відповідальних. */
export function PATCH(req: Request, { params }: Ctx) {
  return guarded(async () => {
    const id = sessionIdParam((await params).id);
    // Минуле перевіряє sessions-service: дату минулої співбесіди можна не змінювати, але не можна перенести в минуле
    const input = parseSessionInput(await readJson(req), { requireFuture: false });
    return NextResponse.json({ session: await updateSession(id, input) });
  });
}
