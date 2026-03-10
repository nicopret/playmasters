export const LANDER_DRIFT_CONFIG_SCHEMA_VERSION = 'lander-drift.config.v1';

export type LanderDriftPhysicsV1 = {
  mass: number;
  thrust: number;
  rotationSpeed: number;
  damping: number;
};

export type LanderDriftLandingV1 = {
  safeVerticalSpeed: number;
  maxTiltDegrees: number;
  padSnapDistance: number;
};

export type LanderDriftFuelV1 = {
  maxFuel: number;
  burnRate: number;
  idleDrainRate: number;
  warningThreshold: number;
};

export type LanderDriftTerrainV1 = {
  degradePerLanding: number;
  degradePerCrash: number;
};

export type LanderDriftAudioV1 = {
  thrusterFeedback: string;
  landingFeedback: string;
  crashFeedback: string;
  rescueAndDeliveryFeedback: string;
  fuelAwareness: string;
  terrainDegradation: string;
  music: string;
};

export type LanderDriftConfigV1 = {
  schemaVersion: typeof LANDER_DRIFT_CONFIG_SCHEMA_VERSION;
  gameId: 'lander-drift';
  ship: {
    assetId: string;
    publishedUrl: string;
    physics: LanderDriftPhysicsV1;
  };
  landing: LanderDriftLandingV1;
  fuel: LanderDriftFuelV1;
  terrain: LanderDriftTerrainV1;
  audio: LanderDriftAudioV1;
};

export type LanderDriftPublishResponse = {
  ok: true;
  gameId: 'lander-drift';
  publishedAssetVersionId: string;
  publishedConfigVersionId: string;
  publishedAt: string;
};
