'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type {
  LanderDriftConfigV1,
  LanderDriftTestScenarioId,
} from '@playmasters/types';
import { LANDER_DRIFT_TEST_SCENARIOS } from '../../../lib/landerDriftTestScenarios';
import styles from './LanderDriftTestSetup.module.css';

type ConfigSource = 'draft' | 'published' | 'defaults';

type TestConfigResponse = {
  source: ConfigSource;
  availableSources: {
    draft: { enabled: boolean; reason?: string };
    published: { enabled: boolean; reason?: string };
    defaults: { enabled: true };
  };
  config: LanderDriftConfigV1;
};

const SOURCE_LABELS: Record<ConfigSource, string> = {
  draft: 'Current Draft Config',
  published: 'Current Published Config',
  defaults: 'Local Defaults / Safe Fallback',
};

export default function LanderDriftTestSetup() {
  const [scenarioId, setScenarioId] =
    useState<LanderDriftTestScenarioId>('intro-basic-flight');
  const [configSource, setConfigSource] = useState<ConfigSource>('draft');
  const [configData, setConfigData] = useState<TestConfigResponse | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seedOverride, setSeedOverride] = useState('');
  const [initialScore, setInitialScore] = useState('');
  const [initialFuel, setInitialFuel] = useState('');
  const [degradationEnabled, setDegradationEnabled] = useState<
    'auto' | 'on' | 'off'
  >('auto');
  const [degradationMultiplier, setDegradationMultiplier] = useState('1');

  const selectedScenario = useMemo(
    () =>
      LANDER_DRIFT_TEST_SCENARIOS.find(
        (scenario) => scenario.id === scenarioId,
      ) ?? LANDER_DRIFT_TEST_SCENARIOS[0],
    [scenarioId],
  );

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoadingConfig(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/admin/games/lander-drift/test/config?source=${encodeURIComponent(configSource)}`,
          {
            cache: 'no-store',
          },
        );
        const json = (await res
          .json()
          .catch(() => ({}))) as TestConfigResponse & {
          error?: string;
        };
        if (!res.ok) throw new Error(json.error ?? 'Failed to load config');
        if (!cancelled) {
          setConfigData(json);
        }
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoadingConfig(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [configSource]);

  const selectedSourceEnabled = useMemo(() => {
    if (!configData) return false;
    return configData.availableSources[configSource].enabled;
  }, [configData, configSource]);

  const launchHref = useMemo(() => {
    const query = new URLSearchParams({
      scenario: scenarioId,
      configSource,
    });
    if (seedOverride.trim()) query.set('seed', seedOverride.trim());
    if (initialScore.trim()) query.set('initialScore', initialScore.trim());
    if (initialFuel.trim()) query.set('initialFuel', initialFuel.trim());
    if (degradationEnabled !== 'auto')
      query.set('degradationEnabled', degradationEnabled);
    if (degradationMultiplier.trim()) {
      query.set('degradationSpeedMultiplier', degradationMultiplier.trim());
    }
    return `/games/lander-drift/test/run?${query.toString()}`;
  }, [
    scenarioId,
    configSource,
    seedOverride,
    initialScore,
    initialFuel,
    degradationEnabled,
    degradationMultiplier,
  ]);

  const physicsSummary = configData?.config;

  return (
    <div className={styles.page}>
      <section className={styles.card}>
        <h2>Test Scenario</h2>
        <p className={styles.meta}>
          Choose a deterministic scenario preset for repeatable testing.
        </p>
        <select
          className={styles.input}
          value={scenarioId}
          onChange={(event) =>
            setScenarioId(event.target.value as LanderDriftTestScenarioId)
          }
        >
          {LANDER_DRIFT_TEST_SCENARIOS.map((scenario) => (
            <option key={scenario.id} value={scenario.id}>
              {scenario.title}
            </option>
          ))}
        </select>
        <p className={styles.description}>{selectedScenario.description}</p>
      </section>

      <section className={styles.card}>
        <h2>Config Source</h2>
        <p className={styles.meta}>
          Select which physics/config source should be applied for this run.
        </p>
        <div className={styles.radioGrid}>
          {(['draft', 'published', 'defaults'] as ConfigSource[]).map(
            (source) => {
              const enabled = configData
                ? configData.availableSources[source].enabled
                : source === 'defaults';
              const reason =
                source === 'defaults'
                  ? undefined
                  : configData?.availableSources[source].reason;
              return (
                <label
                  key={source}
                  className={`${styles.radioCard} ${!enabled ? styles.radioCardDisabled : ''}`}
                >
                  <input
                    type="radio"
                    name="config-source"
                    value={source}
                    checked={configSource === source}
                    disabled={!enabled}
                    onChange={() => setConfigSource(source)}
                  />
                  <span>{SOURCE_LABELS[source]}</span>
                  {!enabled && reason ? <small>{reason}</small> : null}
                </label>
              );
            },
          )}
        </div>
        {loadingConfig ? (
          <p className={styles.meta}>Resolving config...</p>
        ) : null}
      </section>

      <section className={styles.card}>
        <h2>Optional Test Overrides</h2>
        <div className={styles.grid}>
          <label className={styles.field}>
            <span>Scenario Seed</span>
            <input
              className={styles.input}
              value={seedOverride}
              placeholder={selectedScenario.seed}
              onChange={(event) => setSeedOverride(event.target.value)}
            />
          </label>
          <label className={styles.field}>
            <span>Initial Score</span>
            <input
              className={styles.input}
              type="number"
              value={initialScore}
              placeholder={String(
                selectedScenario.runtimeOverrides?.initialScore ?? 0,
              )}
              onChange={(event) => setInitialScore(event.target.value)}
            />
          </label>
          <label className={styles.field}>
            <span>Initial Fuel</span>
            <input
              className={styles.input}
              type="number"
              value={initialFuel}
              placeholder={String(
                selectedScenario.runtimeOverrides?.initialFuel ?? 100,
              )}
              onChange={(event) => setInitialFuel(event.target.value)}
            />
          </label>
          <label className={styles.field}>
            <span>Degradation</span>
            <select
              className={styles.input}
              value={degradationEnabled}
              onChange={(event) =>
                setDegradationEnabled(
                  event.target.value as 'auto' | 'on' | 'off',
                )
              }
            >
              <option value="auto">Scenario Default</option>
              <option value="on">Force On</option>
              <option value="off">Force Off</option>
            </select>
          </label>
          <label className={styles.field}>
            <span>Degradation Speed Multiplier</span>
            <input
              className={styles.input}
              type="number"
              min="0"
              step="0.1"
              value={degradationMultiplier}
              onChange={(event) => setDegradationMultiplier(event.target.value)}
            />
          </label>
        </div>
      </section>

      <section className={styles.card}>
        <h2>Physics Summary</h2>
        {physicsSummary ? (
          <ul className={styles.summaryList}>
            <li>gravity: 9.8</li>
            <li>mass: {physicsSummary.ship.physics.mass}</li>
            <li>thrust: {physicsSummary.ship.physics.thrust}</li>
            <li>rotationSpeed: {physicsSummary.ship.physics.rotationSpeed}</li>
            <li>damping: {physicsSummary.ship.physics.damping}</li>
            <li>
              maxVelocityX:{' '}
              {'maxVelocityX' in physicsSummary.ship.physics
                ? String(
                    (physicsSummary.ship.physics as Record<string, unknown>)
                      .maxVelocityX,
                  )
                : 'n/a'}
            </li>
            <li>
              maxVelocityY:{' '}
              {'maxVelocityY' in physicsSummary.ship.physics
                ? String(
                    (physicsSummary.ship.physics as Record<string, unknown>)
                      .maxVelocityY,
                  )
                : 'n/a'}
            </li>
            <li>
              landing.safeVerticalSpeed:{' '}
              {physicsSummary.landing.safeVerticalSpeed}
            </li>
            <li>
              landing.maxTiltDegrees: {physicsSummary.landing.maxTiltDegrees}
            </li>
            <li>fuel.maxFuel: {physicsSummary.fuel.maxFuel}</li>
            <li>fuel.burnRate: {physicsSummary.fuel.burnRate}</li>
            <li>fuel.idleDrainRate: {physicsSummary.fuel.idleDrainRate}</li>
          </ul>
        ) : (
          <p className={styles.meta}>No config resolved yet.</p>
        )}
      </section>

      <section className={styles.card}>
        <h2>Launch</h2>
        {error ? <p className={styles.error}>Error: {error}</p> : null}
        <div className={styles.actions}>
          <Link
            href={selectedSourceEnabled ? launchHref : '#'}
            className={`${styles.primary} ${
              !selectedSourceEnabled ? styles.primaryDisabled : ''
            }`}
            aria-disabled={!selectedSourceEnabled}
          >
            Launch Test
          </Link>
          <a
            href={selectedSourceEnabled ? launchHref : undefined}
            target="_blank"
            rel="noreferrer"
            className={`${styles.secondary} ${
              !selectedSourceEnabled ? styles.primaryDisabled : ''
            }`}
            aria-disabled={!selectedSourceEnabled}
          >
            Open in New Tab
          </a>
        </div>
        {!selectedSourceEnabled && configData ? (
          <p className={styles.meta}>
            {(configSource === 'defaults'
              ? undefined
              : configData.availableSources[configSource].reason) ??
              'Selected config source is unavailable.'}
          </p>
        ) : null}
      </section>
    </div>
  );
}
