import { NextResponse } from 'next/server';
import { auth } from '../../../../../../../auth';
import {
  getDraftShipSnapshot,
  saveDraftShipAsset,
} from '../../../../../../../../lib/landerDrift';
import type { LanderDriftPhysicsV1 } from '@playmasters/types';

export const runtime = 'nodejs';

const bad = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });

const parsePhysics = (raw: string | null): LanderDriftPhysicsV1 | null => {
  if (!raw) return null;
  const json = JSON.parse(raw) as Partial<LanderDriftPhysicsV1>;
  if (
    typeof json.mass !== 'number' ||
    typeof json.thrust !== 'number' ||
    typeof json.rotationSpeed !== 'number' ||
    typeof json.damping !== 'number'
  ) {
    return null;
  }
  return {
    mass: json.mass,
    thrust: json.thrust,
    rotationSpeed: json.rotationSpeed,
    damping: json.damping,
  };
};

export async function POST(req: Request) {
  let session;
  try {
    session = await auth();
  } catch (err) {
    console.error('lander_drift_draft_ship_auth_failed', err);
    return bad('auth_failed', 500);
  }

  if (process.env.NODE_ENV !== 'development' && !session?.user?.isAdmin) {
    return bad('unauthorized', 401);
  }

  const form = await req.formData();
  const file = form.get('file') as File | null;
  const draftName = String(form.get('draftName') || '').trim();
  const rawPhysics = String(form.get('physics') || '');

  if (!file) return bad('file_required');
  if (!file.type.startsWith('image/')) return bad('image_type_required');
  if (!draftName) return bad('draft_name_required');

  let physics: LanderDriftPhysicsV1 | null = null;
  try {
    physics = parsePhysics(rawPhysics);
  } catch {
    return bad('invalid_physics_json');
  }
  if (!physics) return bad('invalid_physics');

  try {
    const result = await saveDraftShipAsset({
      file,
      draftName,
      physics,
      actor: {
        userId: session?.user?.id ?? 'anonymous',
        email: session?.user?.email ?? undefined,
      },
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const code = (err as Error).message;
    if (code === 'draft_bucket_not_configured')
      return bad('draft_bucket_not_configured', 500);
    console.error('lander_drift_draft_ship_failed', err);
    return bad('save_draft_ship_failed', 500);
  }
}

export async function GET() {
  let session;
  try {
    session = await auth();
  } catch (err) {
    console.error('lander_drift_draft_ship_get_auth_failed', err);
    return bad('auth_failed', 500);
  }

  if (process.env.NODE_ENV !== 'development' && !session?.user?.isAdmin) {
    return bad('unauthorized', 401);
  }

  try {
    const draft = await getDraftShipSnapshot();
    if (!draft) return NextResponse.json({ draft: null });
    const imageUrl = draft.inlineDataUrl
      ? draft.inlineDataUrl
      : draft.s3Key
        ? `/api/admin/games/lander-drift/draft/ship/file?key=${encodeURIComponent(
            draft.s3Key,
          )}`
        : '';
    return NextResponse.json({
      draft: {
        ...draft,
        imageUrl,
      },
    });
  } catch (err) {
    console.error('lander_drift_draft_ship_get_failed', err);
    return bad('get_draft_ship_failed', 500);
  }
}
