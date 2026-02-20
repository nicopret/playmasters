import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { ddbDocClient } from '../../lib/ddb';

export type CoreAssetKind = 'hero' | 'enemy' | 'ammo' | 'vfx' | 'sfx';
export type CoreAssetMedia = 'image' | 'audio';

export type CoreAssetFileRef = {
  objectKey?: string;
  inlineDataUrl?: string;
  fileName: string;
  contentType: string;
  uploadedAt: string;
};

export type CoreAssetFileSlot = {
  slotId: string;
  label: string;
  media: CoreAssetMedia;
  file?: CoreAssetFileRef;
};

export type CoreAssetVariableValue = number | boolean | string;

export type CoreAssetDefinition = {
  id: string;
  displayName: string;
  kind: CoreAssetKind;
  slots: CoreAssetFileSlot[];
  variables: Record<string, CoreAssetVariableValue>;
  fx: Record<string, string>;
};

export type CoreAssetDraft = {
  gameId: string;
  schemaVersion: 'core-assets.v1';
  // TODO(level-editor): keep this as game-level default until per-level backgrounds are introduced.
  defaultTextureKey: string;
  definitions: CoreAssetDefinition[];
  updatedAt: string;
};

type VariableSpec = {
  key: string;
  label: string;
  type: 'number' | 'boolean';
  min?: number;
  max?: number;
  step?: number;
  defaultValue: number | boolean;
};

type FxSpec = {
  key: string;
  label: string;
  allowedKinds: CoreAssetKind[];
};

type SlotSpec = {
  slotId: string;
  label: string;
  media: CoreAssetMedia;
};

export type CoreAssetSpec = {
  id: string;
  displayName: string;
  kind: CoreAssetKind;
  group: 'Hero' | 'Enemies' | 'Ammo' | 'VFX' | 'Audio';
  slots: SlotSpec[];
  variables: VariableSpec[];
  fx: FxSpec[];
};

export const SPACE_BLASTER_CORE_ASSET_SPECS: CoreAssetSpec[] = [
  {
    id: 'hero.playerShip',
    displayName: 'Player Ship',
    kind: 'hero',
    group: 'Hero',
    slots: [
      { slotId: 'spriteKey', label: 'Sprite', media: 'image' },
      {
        slotId: 'hurtFlashSpriteKey',
        label: 'Hurt Flash Sprite',
        media: 'image',
      },
    ],
    variables: [
      {
        key: 'moveSpeed',
        label: 'Move Speed',
        type: 'number',
        min: 0,
        step: 0.1,
        defaultValue: 6,
      },
      {
        key: 'fireCooldownMs',
        label: 'Fire Cooldown (ms)',
        type: 'number',
        min: 0,
        step: 1,
        defaultValue: 180,
      },
      {
        key: 'maxLives',
        label: 'Max Lives',
        type: 'number',
        min: 1,
        step: 1,
        defaultValue: 3,
      },
      {
        key: 'hitboxWidth',
        label: 'Hitbox Width',
        type: 'number',
        min: 0,
        step: 1,
        defaultValue: 28,
      },
      {
        key: 'hitboxHeight',
        label: 'Hitbox Height',
        type: 'number',
        min: 0,
        step: 1,
        defaultValue: 28,
      },
    ],
    fx: [
      { key: 'defaultAmmoId', label: 'Default Ammo', allowedKinds: ['ammo'] },
      { key: 'fireSfxKey', label: 'Fire SFX', allowedKinds: ['sfx'] },
      { key: 'hitSfxKey', label: 'Hit SFX', allowedKinds: ['sfx'] },
      {
        key: 'engineTrailFxKey',
        label: 'Engine Trail VFX',
        allowedKinds: ['vfx'],
      },
      { key: 'deathVfxKey', label: 'Death VFX', allowedKinds: ['vfx'] },
      { key: 'respawnVfxKey', label: 'Respawn VFX', allowedKinds: ['vfx'] },
    ],
  },
  {
    id: 'enemy.grunt',
    displayName: 'Enemy Grunt',
    kind: 'enemy',
    group: 'Enemies',
    slots: [{ slotId: 'spriteKey', label: 'Sprite', media: 'image' }],
    variables: [
      {
        key: 'hp',
        label: 'HP',
        type: 'number',
        min: 1,
        step: 1,
        defaultValue: 1,
      },
      {
        key: 'speed',
        label: 'Speed',
        type: 'number',
        min: 0,
        step: 0.1,
        defaultValue: 2.4,
      },
      {
        key: 'baseScore',
        label: 'Base Score',
        type: 'number',
        min: 0,
        step: 1,
        defaultValue: 40,
      },
      {
        key: 'projectileCooldownMs',
        label: 'Projectile Cooldown (ms)',
        type: 'number',
        min: 0,
        step: 1,
        defaultValue: 850,
      },
      {
        key: 'canDive',
        label: 'Can Dive',
        type: 'boolean',
        defaultValue: false,
      },
      {
        key: 'canShoot',
        label: 'Can Shoot',
        type: 'boolean',
        defaultValue: false,
      },
    ],
    fx: [
      { key: 'ammoId', label: 'Ammo', allowedKinds: ['ammo'] },
      { key: 'fireSfxKey', label: 'Fire SFX', allowedKinds: ['sfx'] },
      { key: 'deathSfxKey', label: 'Death SFX', allowedKinds: ['sfx'] },
      {
        key: 'diveTelegraphSfxKey',
        label: 'Dive Warning SFX',
        allowedKinds: ['sfx'],
      },
      { key: 'explodeFxKey', label: 'Explosion VFX', allowedKinds: ['vfx'] },
      { key: 'diveTrailVfxId', label: 'Dive Trail VFX', allowedKinds: ['vfx'] },
    ],
  },
  {
    id: 'enemy.shooter',
    displayName: 'Enemy Shooter',
    kind: 'enemy',
    group: 'Enemies',
    slots: [{ slotId: 'spriteKey', label: 'Sprite', media: 'image' }],
    variables: [
      {
        key: 'hp',
        label: 'HP',
        type: 'number',
        min: 1,
        step: 1,
        defaultValue: 2,
      },
      {
        key: 'speed',
        label: 'Speed',
        type: 'number',
        min: 0,
        step: 0.1,
        defaultValue: 2.1,
      },
      {
        key: 'baseScore',
        label: 'Base Score',
        type: 'number',
        min: 0,
        step: 1,
        defaultValue: 80,
      },
      {
        key: 'projectileCooldownMs',
        label: 'Projectile Cooldown (ms)',
        type: 'number',
        min: 0,
        step: 1,
        defaultValue: 650,
      },
      {
        key: 'canDive',
        label: 'Can Dive',
        type: 'boolean',
        defaultValue: true,
      },
      {
        key: 'canShoot',
        label: 'Can Shoot',
        type: 'boolean',
        defaultValue: true,
      },
    ],
    fx: [
      { key: 'ammoId', label: 'Ammo', allowedKinds: ['ammo'] },
      { key: 'fireSfxKey', label: 'Fire SFX', allowedKinds: ['sfx'] },
      { key: 'deathSfxKey', label: 'Death SFX', allowedKinds: ['sfx'] },
      {
        key: 'diveTelegraphSfxKey',
        label: 'Dive Warning SFX',
        allowedKinds: ['sfx'],
      },
      { key: 'explodeFxKey', label: 'Explosion VFX', allowedKinds: ['vfx'] },
      { key: 'diveTrailVfxId', label: 'Dive Trail VFX', allowedKinds: ['vfx'] },
    ],
  },
  {
    id: 'enemy.tank',
    displayName: 'Enemy Tank',
    kind: 'enemy',
    group: 'Enemies',
    slots: [{ slotId: 'spriteKey', label: 'Sprite', media: 'image' }],
    variables: [
      {
        key: 'hp',
        label: 'HP',
        type: 'number',
        min: 1,
        step: 1,
        defaultValue: 5,
      },
      {
        key: 'speed',
        label: 'Speed',
        type: 'number',
        min: 0,
        step: 0.1,
        defaultValue: 1.2,
      },
      {
        key: 'baseScore',
        label: 'Base Score',
        type: 'number',
        min: 0,
        step: 1,
        defaultValue: 120,
      },
      {
        key: 'projectileCooldownMs',
        label: 'Projectile Cooldown (ms)',
        type: 'number',
        min: 0,
        step: 1,
        defaultValue: 1100,
      },
      {
        key: 'canDive',
        label: 'Can Dive',
        type: 'boolean',
        defaultValue: false,
      },
      {
        key: 'canShoot',
        label: 'Can Shoot',
        type: 'boolean',
        defaultValue: true,
      },
    ],
    fx: [
      { key: 'ammoId', label: 'Ammo', allowedKinds: ['ammo'] },
      { key: 'fireSfxKey', label: 'Fire SFX', allowedKinds: ['sfx'] },
      { key: 'deathSfxKey', label: 'Death SFX', allowedKinds: ['sfx'] },
      {
        key: 'diveTelegraphSfxKey',
        label: 'Dive Warning SFX',
        allowedKinds: ['sfx'],
      },
      { key: 'explodeFxKey', label: 'Explosion VFX', allowedKinds: ['vfx'] },
      { key: 'diveTrailVfxId', label: 'Dive Trail VFX', allowedKinds: ['vfx'] },
    ],
  },
  {
    id: 'enemy.fast',
    displayName: 'Enemy Fast',
    kind: 'enemy',
    group: 'Enemies',
    slots: [{ slotId: 'spriteKey', label: 'Sprite', media: 'image' }],
    variables: [
      {
        key: 'hp',
        label: 'HP',
        type: 'number',
        min: 1,
        step: 1,
        defaultValue: 1,
      },
      {
        key: 'speed',
        label: 'Speed',
        type: 'number',
        min: 0,
        step: 0.1,
        defaultValue: 3.4,
      },
      {
        key: 'baseScore',
        label: 'Base Score',
        type: 'number',
        min: 0,
        step: 1,
        defaultValue: 70,
      },
      {
        key: 'projectileCooldownMs',
        label: 'Projectile Cooldown (ms)',
        type: 'number',
        min: 0,
        step: 1,
        defaultValue: 700,
      },
      {
        key: 'canDive',
        label: 'Can Dive',
        type: 'boolean',
        defaultValue: true,
      },
      {
        key: 'canShoot',
        label: 'Can Shoot',
        type: 'boolean',
        defaultValue: true,
      },
    ],
    fx: [
      { key: 'ammoId', label: 'Ammo', allowedKinds: ['ammo'] },
      { key: 'fireSfxKey', label: 'Fire SFX', allowedKinds: ['sfx'] },
      { key: 'deathSfxKey', label: 'Death SFX', allowedKinds: ['sfx'] },
      {
        key: 'diveTelegraphSfxKey',
        label: 'Dive Warning SFX',
        allowedKinds: ['sfx'],
      },
      { key: 'explodeFxKey', label: 'Explosion VFX', allowedKinds: ['vfx'] },
      { key: 'diveTrailVfxId', label: 'Dive Trail VFX', allowedKinds: ['vfx'] },
    ],
  },
  {
    id: 'enemy.elite',
    displayName: 'Enemy Elite',
    kind: 'enemy',
    group: 'Enemies',
    slots: [{ slotId: 'spriteKey', label: 'Sprite', media: 'image' }],
    variables: [
      {
        key: 'hp',
        label: 'HP',
        type: 'number',
        min: 1,
        step: 1,
        defaultValue: 4,
      },
      {
        key: 'speed',
        label: 'Speed',
        type: 'number',
        min: 0,
        step: 0.1,
        defaultValue: 2.8,
      },
      {
        key: 'baseScore',
        label: 'Base Score',
        type: 'number',
        min: 0,
        step: 1,
        defaultValue: 140,
      },
      {
        key: 'projectileCooldownMs',
        label: 'Projectile Cooldown (ms)',
        type: 'number',
        min: 0,
        step: 1,
        defaultValue: 600,
      },
      {
        key: 'canDive',
        label: 'Can Dive',
        type: 'boolean',
        defaultValue: true,
      },
      {
        key: 'canShoot',
        label: 'Can Shoot',
        type: 'boolean',
        defaultValue: true,
      },
    ],
    fx: [
      { key: 'ammoId', label: 'Ammo', allowedKinds: ['ammo'] },
      { key: 'fireSfxKey', label: 'Fire SFX', allowedKinds: ['sfx'] },
      { key: 'deathSfxKey', label: 'Death SFX', allowedKinds: ['sfx'] },
      {
        key: 'diveTelegraphSfxKey',
        label: 'Dive Warning SFX',
        allowedKinds: ['sfx'],
      },
      { key: 'explodeFxKey', label: 'Explosion VFX', allowedKinds: ['vfx'] },
      { key: 'diveTrailVfxId', label: 'Dive Trail VFX', allowedKinds: ['vfx'] },
    ],
  },
  {
    id: 'enemy.boss',
    displayName: 'Enemy Boss',
    kind: 'enemy',
    group: 'Enemies',
    slots: [{ slotId: 'spriteKey', label: 'Sprite', media: 'image' }],
    variables: [
      {
        key: 'hp',
        label: 'HP',
        type: 'number',
        min: 1,
        step: 1,
        defaultValue: 30,
      },
      {
        key: 'speed',
        label: 'Speed',
        type: 'number',
        min: 0,
        step: 0.1,
        defaultValue: 1.1,
      },
      {
        key: 'baseScore',
        label: 'Base Score',
        type: 'number',
        min: 0,
        step: 1,
        defaultValue: 1000,
      },
      {
        key: 'projectileCooldownMs',
        label: 'Projectile Cooldown (ms)',
        type: 'number',
        min: 0,
        step: 1,
        defaultValue: 350,
      },
      {
        key: 'canDive',
        label: 'Can Dive',
        type: 'boolean',
        defaultValue: false,
      },
      {
        key: 'canShoot',
        label: 'Can Shoot',
        type: 'boolean',
        defaultValue: true,
      },
    ],
    fx: [
      { key: 'ammoId', label: 'Ammo', allowedKinds: ['ammo'] },
      { key: 'fireSfxKey', label: 'Fire SFX', allowedKinds: ['sfx'] },
      { key: 'deathSfxKey', label: 'Death SFX', allowedKinds: ['sfx'] },
      {
        key: 'diveTelegraphSfxKey',
        label: 'Dive Warning SFX',
        allowedKinds: ['sfx'],
      },
      { key: 'explodeFxKey', label: 'Explosion VFX', allowedKinds: ['vfx'] },
      { key: 'diveTrailVfxId', label: 'Dive Trail VFX', allowedKinds: ['vfx'] },
    ],
  },
  {
    id: 'ammo.player.basic',
    displayName: 'Player Ammo Basic',
    kind: 'ammo',
    group: 'Ammo',
    slots: [{ slotId: 'spriteKey', label: 'Sprite', media: 'image' }],
    variables: [
      {
        key: 'projectileSpeed',
        label: 'Projectile Speed',
        type: 'number',
        min: 0,
        step: 0.1,
        defaultValue: 8.5,
      },
      {
        key: 'damage',
        label: 'Damage',
        type: 'number',
        min: 0,
        step: 1,
        defaultValue: 1,
      },
      {
        key: 'fireCooldownMs',
        label: 'Fire Cooldown (ms)',
        type: 'number',
        min: 0,
        step: 1,
        defaultValue: 180,
      },
      {
        key: 'lifetimeMs',
        label: 'Lifetime (ms)',
        type: 'number',
        min: 0,
        step: 1,
        defaultValue: 1800,
      },
      {
        key: 'turnRate',
        label: 'Turn Rate',
        type: 'number',
        min: 0,
        step: 0.01,
        defaultValue: 0,
      },
    ],
    fx: [
      { key: 'fireSfxKey', label: 'Fire SFX', allowedKinds: ['sfx'] },
      { key: 'impactFxKey', label: 'Impact VFX', allowedKinds: ['vfx'] },
    ],
  },
  {
    id: 'ammo.enemy.basic',
    displayName: 'Enemy Ammo Basic',
    kind: 'ammo',
    group: 'Ammo',
    slots: [{ slotId: 'spriteKey', label: 'Sprite', media: 'image' }],
    variables: [
      {
        key: 'projectileSpeed',
        label: 'Projectile Speed',
        type: 'number',
        min: 0,
        step: 0.1,
        defaultValue: 5.2,
      },
      {
        key: 'damage',
        label: 'Damage',
        type: 'number',
        min: 0,
        step: 1,
        defaultValue: 1,
      },
      {
        key: 'fireCooldownMs',
        label: 'Fire Cooldown (ms)',
        type: 'number',
        min: 0,
        step: 1,
        defaultValue: 700,
      },
      {
        key: 'lifetimeMs',
        label: 'Lifetime (ms)',
        type: 'number',
        min: 0,
        step: 1,
        defaultValue: 1600,
      },
      {
        key: 'turnRate',
        label: 'Turn Rate',
        type: 'number',
        min: 0,
        step: 0.01,
        defaultValue: 0,
      },
    ],
    fx: [
      { key: 'fireSfxKey', label: 'Fire SFX', allowedKinds: ['sfx'] },
      { key: 'impactFxKey', label: 'Impact VFX', allowedKinds: ['vfx'] },
    ],
  },
  {
    id: 'ammo.enemy.fast',
    displayName: 'Enemy Ammo Fast',
    kind: 'ammo',
    group: 'Ammo',
    slots: [{ slotId: 'spriteKey', label: 'Sprite', media: 'image' }],
    variables: [
      {
        key: 'projectileSpeed',
        label: 'Projectile Speed',
        type: 'number',
        min: 0,
        step: 0.1,
        defaultValue: 7.3,
      },
      {
        key: 'damage',
        label: 'Damage',
        type: 'number',
        min: 0,
        step: 1,
        defaultValue: 1,
      },
      {
        key: 'fireCooldownMs',
        label: 'Fire Cooldown (ms)',
        type: 'number',
        min: 0,
        step: 1,
        defaultValue: 620,
      },
      {
        key: 'lifetimeMs',
        label: 'Lifetime (ms)',
        type: 'number',
        min: 0,
        step: 1,
        defaultValue: 1200,
      },
      {
        key: 'turnRate',
        label: 'Turn Rate',
        type: 'number',
        min: 0,
        step: 0.01,
        defaultValue: 0,
      },
    ],
    fx: [
      { key: 'fireSfxKey', label: 'Fire SFX', allowedKinds: ['sfx'] },
      { key: 'impactFxKey', label: 'Impact VFX', allowedKinds: ['vfx'] },
    ],
  },
  {
    id: 'ammo.enemy.tracking',
    displayName: 'Enemy Ammo Tracking',
    kind: 'ammo',
    group: 'Ammo',
    slots: [{ slotId: 'spriteKey', label: 'Sprite', media: 'image' }],
    variables: [
      {
        key: 'projectileSpeed',
        label: 'Projectile Speed',
        type: 'number',
        min: 0,
        step: 0.1,
        defaultValue: 4.4,
      },
      {
        key: 'damage',
        label: 'Damage',
        type: 'number',
        min: 0,
        step: 1,
        defaultValue: 2,
      },
      {
        key: 'fireCooldownMs',
        label: 'Fire Cooldown (ms)',
        type: 'number',
        min: 0,
        step: 1,
        defaultValue: 900,
      },
      {
        key: 'lifetimeMs',
        label: 'Lifetime (ms)',
        type: 'number',
        min: 0,
        step: 1,
        defaultValue: 2000,
      },
      {
        key: 'turnRate',
        label: 'Turn Rate',
        type: 'number',
        min: 0,
        step: 0.01,
        defaultValue: 0.18,
      },
    ],
    fx: [
      { key: 'fireSfxKey', label: 'Fire SFX', allowedKinds: ['sfx'] },
      { key: 'impactFxKey', label: 'Impact VFX', allowedKinds: ['vfx'] },
    ],
  },
  {
    id: 'vfx.explosion.small',
    displayName: 'Explosion Small',
    kind: 'vfx',
    group: 'VFX',
    slots: [
      { slotId: 'spriteKey', label: 'Sprite', media: 'image' },
      { slotId: 'spritesheetKey', label: 'Spritesheet', media: 'image' },
    ],
    variables: [
      {
        key: 'durationMs',
        label: 'Duration (ms)',
        type: 'number',
        min: 0,
        step: 1,
        defaultValue: 220,
      },
      {
        key: 'scale',
        label: 'Scale',
        type: 'number',
        min: 0,
        step: 0.05,
        defaultValue: 1,
      },
      {
        key: 'poolCap',
        label: 'Pool Cap',
        type: 'number',
        min: 0,
        step: 1,
        defaultValue: 32,
      },
    ],
    fx: [],
  },
  {
    id: 'vfx.explosion.medium',
    displayName: 'Explosion Medium',
    kind: 'vfx',
    group: 'VFX',
    slots: [
      { slotId: 'spriteKey', label: 'Sprite', media: 'image' },
      { slotId: 'spritesheetKey', label: 'Spritesheet', media: 'image' },
    ],
    variables: [
      {
        key: 'durationMs',
        label: 'Duration (ms)',
        type: 'number',
        min: 0,
        step: 1,
        defaultValue: 320,
      },
      {
        key: 'scale',
        label: 'Scale',
        type: 'number',
        min: 0,
        step: 0.05,
        defaultValue: 1.25,
      },
      {
        key: 'poolCap',
        label: 'Pool Cap',
        type: 'number',
        min: 0,
        step: 1,
        defaultValue: 24,
      },
    ],
    fx: [],
  },
  {
    id: 'vfx.explosion.large',
    displayName: 'Explosion Large',
    kind: 'vfx',
    group: 'VFX',
    slots: [
      { slotId: 'spriteKey', label: 'Sprite', media: 'image' },
      { slotId: 'spritesheetKey', label: 'Spritesheet', media: 'image' },
    ],
    variables: [
      {
        key: 'durationMs',
        label: 'Duration (ms)',
        type: 'number',
        min: 0,
        step: 1,
        defaultValue: 440,
      },
      {
        key: 'scale',
        label: 'Scale',
        type: 'number',
        min: 0,
        step: 0.05,
        defaultValue: 1.7,
      },
      {
        key: 'poolCap',
        label: 'Pool Cap',
        type: 'number',
        min: 0,
        step: 1,
        defaultValue: 16,
      },
    ],
    fx: [],
  },
  {
    id: 'vfx.hitSpark',
    displayName: 'Hit Spark',
    kind: 'vfx',
    group: 'VFX',
    slots: [{ slotId: 'spriteKey', label: 'Sprite', media: 'image' }],
    variables: [
      {
        key: 'durationMs',
        label: 'Duration (ms)',
        type: 'number',
        min: 0,
        step: 1,
        defaultValue: 110,
      },
      {
        key: 'scale',
        label: 'Scale',
        type: 'number',
        min: 0,
        step: 0.05,
        defaultValue: 1,
      },
      {
        key: 'poolCap',
        label: 'Pool Cap',
        type: 'number',
        min: 0,
        step: 1,
        defaultValue: 80,
      },
    ],
    fx: [],
  },
  {
    id: 'vfx.diveWarning',
    displayName: 'Dive Warning',
    kind: 'vfx',
    group: 'VFX',
    slots: [{ slotId: 'spriteKey', label: 'Sprite', media: 'image' }],
    variables: [
      {
        key: 'durationMs',
        label: 'Duration (ms)',
        type: 'number',
        min: 0,
        step: 1,
        defaultValue: 350,
      },
      {
        key: 'scale',
        label: 'Scale',
        type: 'number',
        min: 0,
        step: 0.05,
        defaultValue: 1.1,
      },
      {
        key: 'poolCap',
        label: 'Pool Cap',
        type: 'number',
        min: 0,
        step: 1,
        defaultValue: 12,
      },
    ],
    fx: [],
  },
  {
    id: 'sfx.player.fire',
    displayName: 'SFX Player Fire',
    kind: 'sfx',
    group: 'Audio',
    slots: [{ slotId: 'audioKey', label: 'Audio', media: 'audio' }],
    variables: [
      {
        key: 'volume',
        label: 'Volume',
        type: 'number',
        min: 0,
        max: 1,
        step: 0.01,
        defaultValue: 0.9,
      },
      {
        key: 'isMusic',
        label: 'Music Category',
        type: 'boolean',
        defaultValue: false,
      },
    ],
    fx: [],
  },
  {
    id: 'sfx.enemy.fire',
    displayName: 'SFX Enemy Fire',
    kind: 'sfx',
    group: 'Audio',
    slots: [{ slotId: 'audioKey', label: 'Audio', media: 'audio' }],
    variables: [
      {
        key: 'volume',
        label: 'Volume',
        type: 'number',
        min: 0,
        max: 1,
        step: 0.01,
        defaultValue: 0.8,
      },
      {
        key: 'isMusic',
        label: 'Music Category',
        type: 'boolean',
        defaultValue: false,
      },
    ],
    fx: [],
  },
  {
    id: 'sfx.hit',
    displayName: 'SFX Hit',
    kind: 'sfx',
    group: 'Audio',
    slots: [{ slotId: 'audioKey', label: 'Audio', media: 'audio' }],
    variables: [
      {
        key: 'volume',
        label: 'Volume',
        type: 'number',
        min: 0,
        max: 1,
        step: 0.01,
        defaultValue: 0.8,
      },
      {
        key: 'isMusic',
        label: 'Music Category',
        type: 'boolean',
        defaultValue: false,
      },
    ],
    fx: [],
  },
  {
    id: 'sfx.explosion.small',
    displayName: 'SFX Explosion Small',
    kind: 'sfx',
    group: 'Audio',
    slots: [{ slotId: 'audioKey', label: 'Audio', media: 'audio' }],
    variables: [
      {
        key: 'volume',
        label: 'Volume',
        type: 'number',
        min: 0,
        max: 1,
        step: 0.01,
        defaultValue: 0.9,
      },
      {
        key: 'isMusic',
        label: 'Music Category',
        type: 'boolean',
        defaultValue: false,
      },
    ],
    fx: [],
  },
  {
    id: 'sfx.explosion.large',
    displayName: 'SFX Explosion Large',
    kind: 'sfx',
    group: 'Audio',
    slots: [{ slotId: 'audioKey', label: 'Audio', media: 'audio' }],
    variables: [
      {
        key: 'volume',
        label: 'Volume',
        type: 'number',
        min: 0,
        max: 1,
        step: 0.01,
        defaultValue: 1,
      },
      {
        key: 'isMusic',
        label: 'Music Category',
        type: 'boolean',
        defaultValue: false,
      },
    ],
    fx: [],
  },
  {
    id: 'sfx.waveClear',
    displayName: 'SFX Wave Clear',
    kind: 'sfx',
    group: 'Audio',
    slots: [{ slotId: 'audioKey', label: 'Audio', media: 'audio' }],
    variables: [
      {
        key: 'volume',
        label: 'Volume',
        type: 'number',
        min: 0,
        max: 1,
        step: 0.01,
        defaultValue: 0.9,
      },
      {
        key: 'isMusic',
        label: 'Music Category',
        type: 'boolean',
        defaultValue: false,
      },
    ],
    fx: [],
  },
  {
    id: 'sfx.tierUp',
    displayName: 'SFX Tier Up',
    kind: 'sfx',
    group: 'Audio',
    slots: [{ slotId: 'audioKey', label: 'Audio', media: 'audio' }],
    variables: [
      {
        key: 'volume',
        label: 'Volume',
        type: 'number',
        min: 0,
        max: 1,
        step: 0.01,
        defaultValue: 0.85,
      },
      {
        key: 'isMusic',
        label: 'Music Category',
        type: 'boolean',
        defaultValue: false,
      },
    ],
    fx: [],
  },
  {
    id: 'sfx.gameOver',
    displayName: 'SFX Game Over',
    kind: 'sfx',
    group: 'Audio',
    slots: [{ slotId: 'audioKey', label: 'Audio', media: 'audio' }],
    variables: [
      {
        key: 'volume',
        label: 'Volume',
        type: 'number',
        min: 0,
        max: 1,
        step: 0.01,
        defaultValue: 0.9,
      },
      {
        key: 'isMusic',
        label: 'Music Category',
        type: 'boolean',
        defaultValue: false,
      },
    ],
    fx: [],
  },
  {
    id: 'sfx.diveWarning',
    displayName: 'SFX Dive Warning',
    kind: 'sfx',
    group: 'Audio',
    slots: [{ slotId: 'audioKey', label: 'Audio', media: 'audio' }],
    variables: [
      {
        key: 'volume',
        label: 'Volume',
        type: 'number',
        min: 0,
        max: 1,
        step: 0.01,
        defaultValue: 0.8,
      },
      {
        key: 'isMusic',
        label: 'Music Category',
        type: 'boolean',
        defaultValue: false,
      },
    ],
    fx: [],
  },
];

const CORE_ASSETS_TABLE =
  process.env.DDB_TABLE_GAME_CORE_ASSETS ?? 'PlaymastersGameAssets';
const PK_ATTR =
  process.env.DDB_PK_NAME_GAME_CORE_ASSETS || process.env.DDB_PK_NAME || 'PK';
const SK_ATTR =
  process.env.DDB_SK_NAME_GAME_CORE_ASSETS || process.env.DDB_SK_NAME || 'SK';

const coreAssetsKey = (gameId: string) => ({
  [PK_ATTR]: `GAME#${gameId}`,
  [SK_ATTR]: 'CORE_ASSETS#DRAFT',
});

export type CoreAssetValidationIssue = {
  path: string;
  message: string;
};

export function createDefaultCoreAssetsDraft(gameId: string): CoreAssetDraft {
  const now = new Date().toISOString();
  const definitions: CoreAssetDefinition[] = SPACE_BLASTER_CORE_ASSET_SPECS.map(
    (spec) => ({
      id: spec.id,
      displayName: spec.displayName,
      kind: spec.kind,
      slots: spec.slots.map((slot) => ({
        slotId: slot.slotId,
        label: slot.label,
        media: slot.media,
      })),
      variables: Object.fromEntries(
        spec.variables.map((variable) => [variable.key, variable.defaultValue]),
      ),
      fx: Object.fromEntries(spec.fx.map((fx) => [fx.key, ''])),
    }),
  );

  return {
    gameId,
    schemaVersion: 'core-assets.v1',
    defaultTextureKey: 'default.space.background',
    definitions,
    updatedAt: now,
  };
}

export function getCoreAssetSpecMap(): Map<string, CoreAssetSpec> {
  return new Map(SPACE_BLASTER_CORE_ASSET_SPECS.map((spec) => [spec.id, spec]));
}

export function validateCoreAssetsDraft(
  draft: CoreAssetDraft,
): CoreAssetValidationIssue[] {
  const issues: CoreAssetValidationIssue[] = [];
  const specById = getCoreAssetSpecMap();
  const definitions = Array.isArray(draft.definitions) ? draft.definitions : [];
  const ids = new Set(definitions.map((definition) => definition.id));

  definitions.forEach((definition, definitionIdx) => {
    const spec = specById.get(definition.id);
    if (!spec) {
      issues.push({
        path: `definitions[${definitionIdx}].id`,
        message: `Unknown core asset id '${definition.id}'.`,
      });
      return;
    }

    if (definition.kind !== spec.kind) {
      issues.push({
        path: `definitions[${definitionIdx}].kind`,
        message: `Invalid kind '${definition.kind}' for '${definition.id}'.`,
      });
    }

    spec.variables.forEach((variableSpec) => {
      const value = definition.variables?.[variableSpec.key];
      const path = `definitions[${definitionIdx}].variables.${variableSpec.key}`;
      if (variableSpec.type === 'boolean') {
        if (typeof value !== 'boolean') {
          issues.push({ path, message: 'Expected boolean.' });
        }
        return;
      }

      if (typeof value !== 'number' || !Number.isFinite(value)) {
        issues.push({ path, message: 'Expected finite number.' });
        return;
      }
      if (typeof variableSpec.min === 'number' && value < variableSpec.min) {
        issues.push({
          path,
          message: `Must be >= ${variableSpec.min}.`,
        });
      }
      if (typeof variableSpec.max === 'number' && value > variableSpec.max) {
        issues.push({
          path,
          message: `Must be <= ${variableSpec.max}.`,
        });
      }
    });

    spec.fx.forEach((fxSpec) => {
      const value = definition.fx?.[fxSpec.key];
      if (!value) return;
      if (!ids.has(value)) {
        issues.push({
          path: `definitions[${definitionIdx}].fx.${fxSpec.key}`,
          message: `Unknown reference '${value}'.`,
        });
        return;
      }
      const referenced = definitions.find((item) => item.id === value);
      if (!referenced) return;
      if (!fxSpec.allowedKinds.includes(referenced.kind)) {
        issues.push({
          path: `definitions[${definitionIdx}].fx.${fxSpec.key}`,
          message: `Reference '${value}' must be one of: ${fxSpec.allowedKinds.join(', ')}.`,
        });
      }
    });
  });

  SPACE_BLASTER_CORE_ASSET_SPECS.forEach((spec) => {
    if (!ids.has(spec.id)) {
      issues.push({
        path: `definitions[${spec.id}]`,
        message: `Missing required core asset '${spec.id}'.`,
      });
    }
  });

  return issues;
}

export async function getCoreAssetsDraft(
  gameId: string,
): Promise<CoreAssetDraft> {
  const res = await ddbDocClient.send(
    new GetCommand({
      TableName: CORE_ASSETS_TABLE,
      Key: coreAssetsKey(gameId),
    }),
  );

  if (!res.Item) return createDefaultCoreAssetsDraft(gameId);

  const { [PK_ATTR]: _pk, [SK_ATTR]: _sk, ...rest } = res.Item;
  void _pk;
  void _sk;
  const candidate = rest as Partial<CoreAssetDraft>;
  if (!Array.isArray(candidate.definitions)) {
    return createDefaultCoreAssetsDraft(gameId);
  }
  return {
    gameId,
    schemaVersion: 'core-assets.v1',
    defaultTextureKey:
      typeof candidate.defaultTextureKey === 'string'
        ? candidate.defaultTextureKey
        : 'default.space.background',
    definitions: candidate.definitions as CoreAssetDefinition[],
    updatedAt:
      typeof candidate.updatedAt === 'string'
        ? candidate.updatedAt
        : new Date().toISOString(),
  };
}

export async function saveCoreAssetsDraft(
  draft: CoreAssetDraft,
): Promise<CoreAssetDraft> {
  const next: CoreAssetDraft = {
    ...draft,
    schemaVersion: 'core-assets.v1',
    updatedAt: new Date().toISOString(),
  };

  await ddbDocClient.send(
    new PutCommand({
      TableName: CORE_ASSETS_TABLE,
      Item: {
        ...coreAssetsKey(draft.gameId),
        ...next,
      },
    }),
  );

  return next;
}
