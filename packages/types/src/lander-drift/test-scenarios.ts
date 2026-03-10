export type LanderDriftTestScenarioId =
  | 'intro-basic-flight'
  | 'rescue-routing'
  | 'offload-banking'
  | 'degradation-preview'
  | 'high-difficulty';

export type LanderDriftTerrainProfile = {
  roughness: number;
  amplitude: number;
  visibilityRadius: number;
};

export type LanderDriftRescueProfile = {
  clusterCount: number;
  targetsPerCluster: number;
  maxDistance: number;
};

export type LanderDriftDegradationProfile = {
  enabled: boolean;
  startAfterSeconds: number;
  speed: number;
};

export type LanderDriftRuntimeOverrides = {
  initialScore?: number;
  initialFuel?: number;
};

export type LanderDriftTestScenario = {
  id: LanderDriftTestScenarioId;
  title: string;
  description: string;
  seed: string;
  terrainProfile: LanderDriftTerrainProfile;
  rescueProfile: LanderDriftRescueProfile;
  degradationProfile: LanderDriftDegradationProfile;
  runtimeOverrides?: LanderDriftRuntimeOverrides;
};
