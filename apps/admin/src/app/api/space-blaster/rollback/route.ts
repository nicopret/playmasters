import { NextResponse } from 'next/server';
import { auth } from '../../../../auth';
import {
  rollbackBundle,
  getBundleVersion,
} from '../../../../../lib/bundleStore';
import { logAudit } from '../../../../../lib/audit';

export const runtime = 'nodejs';

const bad = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });

export async function POST(req: Request) {
  const session = await auth();
  if (process.env.NODE_ENV !== 'development' && !session?.user?.isAdmin)
    return bad('unauthorized', 401);

  const { env = 'dev', targetVersionId } = (await req
    .json()
    .catch(() => ({}))) as {
    env?: string;
    targetVersionId?: string;
  };
  if (!targetVersionId) return bad('targetVersionId_required', 400);

  const target = await getBundleVersion(env, targetVersionId);
  if (!target) return bad('target_not_found', 404);

  try {
    const result = await rollbackBundle({ env, targetVersionId });
    await logAudit({
      entityType: 'SpaceBlasterBundle',
      entityId: env,
      action: 'PUBLISH_BUNDLE',
      actorUserId: session?.user?.id,
      actorEmail: session?.user?.email ?? undefined,
      env,
      domain: 'SpaceBlaster',
      prevVersion: result.prevVersionId,
      newVersion: result.newVersionId,
      status: 'success',
      timestamp: new Date().toISOString(),
      details: { action: 'rollback' },
    });
    return NextResponse.json({
      ok: true,
      prevVersionId: result.prevVersionId,
      newVersionId: result.newVersionId,
    });
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === 'target_not_found') return bad('target_not_found', 404);
    if (msg.includes('ConditionalCheckFailed'))
      return bad('pointer_conflict', 409);
    console.error('rollback_error', err);
    return bad('rollback_failed', 500);
  }
}
