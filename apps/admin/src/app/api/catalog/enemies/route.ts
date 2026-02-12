import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';

const SAMPLE_PATH = path.join(
  process.cwd(),
  'packages',
  'types',
  'src',
  'space-blaster',
  'samples',
  'v1',
  'enemy-catalog.v1.json',
);

type EnemyRecord = {
  enemyId: string;
  displayName?: string;
  spriteKey?: string;
  hp?: number;
};

const bad = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });

export async function GET() {
  try {
    const raw = await fs.promises.readFile(SAMPLE_PATH, 'utf8');
    const json = JSON.parse(raw) as { enemies?: EnemyRecord[] };
    const enemies = (json.enemies ?? []).map((e) => ({
      enemyId: e.enemyId,
      displayName: e.displayName ?? e.enemyId,
      spriteKey: e.spriteKey,
      hp: e.hp,
    }));
    return NextResponse.json({ enemies });
  } catch (err) {
    console.error('enemy_catalog_read_error', err);
    return bad('catalog_failed', 500);
  }
}
