import { NextResponse } from 'next/server';
import { auth } from '../../../../../../../auth';
import type { AstroDefenderConfigV1 } from '@playmasters/types';
import {
  getAstroDefenderDraftSnapshot,
  saveAstroDefenderDraftConfig,
  validateAstroDefenderConfig,
} from '../../../../../../../../lib/astroDefender';

export const runtime = 'nodejs';

const bad = (message: string, status = 400, details?: unknown) =>
  NextResponse.json(
    details ? { error: message, details } : { error: message },
    { status },
  );

const assertAdmin = async () => {
  let session;
  try {
    session = await auth();
  } catch (err) {
    console.error('astro_defender_draft_config_auth_failed', err);
    throw new Error('auth_failed');
  }
  if (process.env.NODE_ENV !== 'development' && !session?.user?.isAdmin) {
    throw new Error('unauthorized');
  }
  return session;
};

export async function GET() {
  try {
    await assertAdmin();
  } catch (err) {
    const code = (err as Error).message;
    if (code === 'unauthorized') return bad('unauthorized', 401);
    return bad('auth_failed', 500);
  }

  try {
    const snapshot = await getAstroDefenderDraftSnapshot();
    const issues = validateAstroDefenderConfig(snapshot.config);
    return NextResponse.json({
      ok: true,
      ...snapshot,
      validation: {
        valid: issues.length === 0,
        issues,
      },
    });
  } catch (err) {
    console.error('astro_defender_draft_config_get_failed', err);
    return bad('fetch_draft_config_failed', 500);
  }
}

export async function POST(req: Request) {
  let session;
  try {
    session = await assertAdmin();
  } catch (err) {
    const code = (err as Error).message;
    if (code === 'unauthorized') return bad('unauthorized', 401);
    return bad('auth_failed', 500);
  }

  const body = (await req.json().catch(() => ({}))) as {
    config?: AstroDefenderConfigV1;
    changeNotes?: string;
  };
  if (!body.config) return bad('config_required');

  const issues = validateAstroDefenderConfig(body.config);
  if (issues.length > 0) {
    return bad('validation_failed', 400, issues);
  }

  try {
    const result = await saveAstroDefenderDraftConfig({
      config: body.config,
      actor: {
        userId: session?.user?.id ?? 'anonymous',
        email: session?.user?.email ?? undefined,
      },
      changeNotes: body.changeNotes,
    });
    return NextResponse.json({
      ok: true,
      gameId: 'astro-defender',
      ...result,
    });
  } catch (err) {
    const code = (err as Error).message;
    const details = (err as Error & { details?: unknown }).details;
    if (code === 'validation_failed') {
      return bad('validation_failed', 400, details);
    }
    console.error('astro_defender_draft_config_save_failed', err);
    return bad('save_draft_config_failed', 500);
  }
}
