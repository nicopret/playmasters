/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { auth } from '../../../auth';

const bad = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });
export const runtime = 'nodejs';

// simple in-memory rate limit per user (per hour)
const hits = new Map<string, { count: number; reset: number }>();
const WINDOW_MS = 60 * 60 * 1000;
const MAX_HITS = 10;

const stylePrefix: Record<string, string> = {
  pixel:
    'Pixel art style. Preserve sharp edges, no anti-aliasing, no blur. Maintain original resolution and grid alignment. ',
  minimal: 'Minimal changes. Preserve structure and original style. ',
  modern: '',
};

export async function POST(req: Request) {
  const session = await auth();
  if (process.env.NODE_ENV !== 'development' && !session?.user?.isAdmin)
    return bad('unauthorized', 401);
  if (!process.env.OPENAI_API_KEY) return bad('openai_not_configured', 500);

  const form = await req.formData();
  const image = form.get('image') as File | null;
  const mask = form.get('mask') as File | null;
  const prompt = (form.get('prompt') as string | null)?.trim() || '';
  const style = (form.get('style') as string | null) ?? 'pixel';
  const assetId = (form.get('assetId') as string | null) ?? '';
  const derivedFromVersionId =
    (form.get('derivedFromVersionId') as string | null) ?? '';

  if (!image) return bad('image_required');
  if (!prompt) return bad('prompt_required');

  // rate limit
  const key = session?.user?.id || 'anon';
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || entry.reset < now) {
    hits.set(key, { count: 1, reset: now + WINDOW_MS });
  } else if (entry.count >= MAX_HITS) {
    return bad('rate_limited', 429);
  } else {
    entry.count += 1;
    hits.set(key, entry);
  }

  const fullPrompt = `${stylePrefix[style] ?? ''}${prompt}`.trim();

  const apiForm = new FormData();
  apiForm.append('prompt', fullPrompt);
  apiForm.append('image', image);
  if (mask) apiForm.append('mask', mask);
  apiForm.append('response_format', 'b64_json');

  let aiImage: string | null = null;
  try {
    const res = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: apiForm as any,
    });
    if (!res.ok) {
      const text = await res.text();
      console.error('openai_error', res.status, text);
      return bad('openai_failed', 502);
    }
    const json = (await res.json()) as { data?: { b64_json: string }[] };
    aiImage = json.data?.[0]?.b64_json ?? null;
    if (!aiImage) return bad('invalid_response', 502);
  } catch (err) {
    console.error('openai_call_error', err);
    return bad('openai_error', 502);
  }

  // Basic validation: ensure decode works
  try {
    Buffer.from(aiImage, 'base64');
  } catch {
    return bad('invalid_image', 502);
  }

  return NextResponse.json({
    previewImageBase64: aiImage,
    assetId,
    derivedFromVersionId,
  });
}
