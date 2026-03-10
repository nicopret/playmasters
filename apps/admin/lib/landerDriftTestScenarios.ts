import type {
  LanderDriftTestScenario,
  LanderDriftTestScenarioId,
} from '@playmasters/types';

export const LANDER_DRIFT_TEST_SCENARIOS: LanderDriftTestScenario[] = [
  {
    id: 'intro-basic-flight',
    title: 'Intro / Basic Flight',
    description:
      'Stable terrain, close rescue points, no degradation, forgiving setup.',
    seed: 'intro-001',
    terrainProfile: { roughness: 0.2, amplitude: 12, visibilityRadius: 220 },
    rescueProfile: { clusterCount: 2, targetsPerCluster: 2, maxDistance: 180 },
    degradationProfile: { enabled: false, startAfterSeconds: 9999, speed: 0 },
    runtimeOverrides: { initialFuel: 100, initialScore: 0 },
  },
  {
    id: 'rescue-routing',
    title: 'Rescue Routing',
    description:
      'Multiple rescue clusters at distance for scouting and route planning.',
    seed: 'routing-017',
    terrainProfile: { roughness: 0.35, amplitude: 18, visibilityRadius: 300 },
    rescueProfile: { clusterCount: 4, targetsPerCluster: 3, maxDistance: 360 },
    degradationProfile: { enabled: true, startAfterSeconds: 180, speed: 0.2 },
    runtimeOverrides: { initialFuel: 90, initialScore: 1200 },
  },
  {
    id: 'offload-banking',
    title: 'Offload / Banking',
    description:
      'Short-to-medium loops for repeated pickup and offload banking flow.',
    seed: 'bank-042',
    terrainProfile: { roughness: 0.42, amplitude: 16, visibilityRadius: 260 },
    rescueProfile: { clusterCount: 3, targetsPerCluster: 4, maxDistance: 260 },
    degradationProfile: { enabled: true, startAfterSeconds: 140, speed: 0.35 },
    runtimeOverrides: { initialFuel: 85, initialScore: 2600 },
  },
  {
    id: 'degradation-preview',
    title: 'Degradation Preview',
    description:
      'Later-phase terrain degradation made visible for landing area collapse checks.',
    seed: 'degrade-231',
    terrainProfile: { roughness: 0.55, amplitude: 24, visibilityRadius: 320 },
    rescueProfile: { clusterCount: 3, targetsPerCluster: 2, maxDistance: 320 },
    degradationProfile: { enabled: true, startAfterSeconds: 20, speed: 0.9 },
    runtimeOverrides: { initialFuel: 75, initialScore: 6400 },
  },
  {
    id: 'high-difficulty',
    title: 'High Difficulty / Late Run',
    description:
      'Fast degradation and demanding pressure for high-level handling checks.',
    seed: 'late-999',
    terrainProfile: { roughness: 0.72, amplitude: 30, visibilityRadius: 360 },
    rescueProfile: { clusterCount: 5, targetsPerCluster: 3, maxDistance: 420 },
    degradationProfile: { enabled: true, startAfterSeconds: 12, speed: 1.4 },
    runtimeOverrides: { initialFuel: 68, initialScore: 12000 },
  },
];

export const getLanderDriftScenarioById = (
  id: LanderDriftTestScenarioId,
): LanderDriftTestScenario | undefined =>
  LANDER_DRIFT_TEST_SCENARIOS.find((scenario) => scenario.id === id);
