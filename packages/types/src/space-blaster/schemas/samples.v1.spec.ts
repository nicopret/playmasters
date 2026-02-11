import * as path from 'path';
import * as fs from 'fs';
import { SpaceBlasterSchema } from './index';
import { validateSchema } from './validateSchema';

const samplesDir = path.join(__dirname, '../samples/v1');

type SampleEntry = {
  file: string;
  domain: keyof typeof SpaceBlasterSchema;
};

const requiredSamples: SampleEntry[] = [
  { file: 'game-config.v1.json', domain: 'gameConfig' },
  { file: 'hero-catalog.v1.json', domain: 'heroCatalog' },
  { file: 'enemy-catalog.v1.json', domain: 'enemyCatalog' },
  { file: 'ammo-catalog.v1.json', domain: 'ammoCatalog' },
  { file: 'formation-layouts.v1.json', domain: 'formationLayouts' },
  { file: 'score-config.v1.json', domain: 'scoreConfig' }
];

const levelFiles = ['level-1.v1.json', 'level-2.v1.json', 'level-3.v1.json'];

function loadJson(file: string) {
  const full = path.join(samplesDir, file);
  return JSON.parse(fs.readFileSync(full, 'utf-8'));
}

describe('SpaceBlaster samples v1 golden set', () => {
  it('has the minimum required sample files', () => {
    const files = fs.readdirSync(samplesDir);

    // required top-level samples
    for (const entry of requiredSamples) {
      expect(files).toContain(entry.file);
    }

    // at least 3 level configs
    const levels = files.filter((f) => f.startsWith('level-') && f.endsWith('.json'));
    expect(levels.length).toBeGreaterThanOrEqual(3);
  });

  it('validates all samples against their schemas', () => {
    // validate required
    for (const entry of requiredSamples) {
      const payload = loadJson(entry.file);
      const result = validateSchema(entry.domain, SpaceBlasterSchema[entry.domain], payload);
      expect(result.valid).toBe(true);
    }

    // validate levels
    for (const file of levelFiles) {
      const payload = loadJson(file);
      const result = validateSchema('LevelConfig', SpaceBlasterSchema.levelConfig, payload);
      expect(result.valid).toBe(true);
    }
  });

  it('enforces cross-file consistency (IDs resolve)', () => {
    const hero = loadJson('hero-catalog.v1.json');
    const ammo = loadJson('ammo-catalog.v1.json');
    const enemies = loadJson('enemy-catalog.v1.json');
    const formations = loadJson('formation-layouts.v1.json');
    const score = loadJson('score-config.v1.json');
    const levels = levelFiles.map(loadJson);

    const ammoIds = new Set(ammo.entries.map((e: any) => e.ammoId));
    const heroAmmo = new Set(hero.entries.map((h: any) => h.defaultAmmoId));
    heroAmmo.forEach((id) => expect(ammoIds.has(id)).toBe(true));

    const enemyIds = new Set(enemies.entries.map((e: any) => e.enemyId));
    const levelEnemyIds = new Set<string>();
    levels.forEach((lvl) => {
      (lvl.enemyTypes || []).forEach((id: string) => levelEnemyIds.add(id));
      (lvl.waves || []).forEach((w: any) => levelEnemyIds.add(w.enemyId));
    });
    levelEnemyIds.forEach((id) => expect(enemyIds.has(id)).toBe(true));

    const scoreEnemyIds = new Set(score.baseEnemyScores.map((e: any) => e.enemyId));
    levelEnemyIds.forEach((id) => expect(scoreEnemyIds.has(id)).toBe(true));

    const layoutIds = new Set(formations.entries.map((l: any) => l.layoutId));
    levels.forEach((lvl) => expect(layoutIds.has(lvl.layoutId)).toBe(true));

    // at least 2 layouts
    expect(layoutIds.size).toBeGreaterThanOrEqual(2);
  });
});
