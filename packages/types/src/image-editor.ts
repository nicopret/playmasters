/**
 * ImageAsset represents a logical asset (e.g., a background or sprite) with pointers to its current versions.
 * Keys are designed for single-table DynamoDB:
 *   PK = `ASSET#${assetId}`, SK = 'META'
 */
export type ImageAsset = {
  assetId: string;
  type: 'background' | 'sprite' | 'splash' | 'ui';
  title: string;
  tags: string[];
  width: number;
  height: number;
  createdAt: string;
  updatedAt: string;
  currentDraftVersionId?: string;
  currentPublishedVersionId?: string;
};

/**
 * ImageAssetVersion models a specific uploaded revision.
 * Stored with PK = `ASSET#${assetId}`, SK = `VERSION#${versionId}` in a single-table layout.
 */
export type ImageAssetVersion = {
  versionId: string;
  assetId: string;
  state: 'Draft' | 'Published' | 'Archived';
  storageKey: string; // S3 key
  createdBy: string;
  createdAt: string;
  changeNotes?: string;
  derivedFromVersionId?: string | null;
};

export type LevelConfig = {
  gameId: string;
  levelId: string;
  layoutId?: string;
  backgroundAssetId?: string;
  backgroundVersionId?: string;
  pinnedToVersion?: boolean;
  updatedAt: string;
  // Gameplay fields used by admin editor
  waves?: Array<{
    enemies?: Array<{ enemyId?: string; count?: number }>;
    overrides?: Record<string, unknown>;
  }>;
  fleetSpeed?: number;
  rampFactor?: number;
  descendStep?: number;
  maxConcurrentDivers?: number;
  maxConcurrentShots?: number;
  attackTickMs?: number;
  diveChancePerTick?: number;
  divePattern?: string;
  turnRate?: number;
  fireTickMs?: number;
  fireChancePerTick?: number;
};
