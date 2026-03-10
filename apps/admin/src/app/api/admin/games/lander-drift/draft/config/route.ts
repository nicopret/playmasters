import { NextResponse } from 'next/server';
import { auth } from '../../../../../../../auth';
import {
  saveDraftConfig,
  validateLanderDriftConfig,
} from '../../../../../../../../lib/landerDrift';
import type { LanderDriftConfigV1 } from '@playmasters/types';

export const runtime = 'nodejs';

const bad = (message: string, status = 400, details?: unknown) =>
  NextResponse.json(
    details ? { error: message, details } : { error: message },
    { status },
  );

export async function POST(req: Request) {
  let session;
  try {
    session = await auth();
  } catch (err) {
    console.error('lander_drift_draft_config_auth_failed', err);
    return bad('auth_failed', 500);
  }

  if (process.env.NODE_ENV !== 'development' && !session?.user?.isAdmin) {
    return bad('unauthorized', 401);
  }

  const body = (await req.json().catch(() => ({}))) as {
    config?: LanderDriftConfigV1;
    changeNotes?: string;
  };

  if (!body.config) return bad('config_required');
  const issues = validateLanderDriftConfig(body.config);
  if (issues.length > 0) {
    return bad('validation_failed', 400, issues);
  }

  try {
    const result = await saveDraftConfig({
      config: body.config,
      actor: {
        userId: session?.user?.id ?? 'anonymous',
        email: session?.user?.email ?? undefined,
      },
      changeNotes: body.changeNotes,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const code = (err as Error).message;
    const details = (err as Error & { details?: unknown }).details;
    if (code === 'validation_failed')
      return bad('validation_failed', 400, details);
    if (code === 'draft_bucket_not_configured')
      return bad('draft_bucket_not_configured', 500);
    console.error('lander_drift_draft_config_failed', err);
    return bad('save_draft_config_failed', 500);
  }
}
