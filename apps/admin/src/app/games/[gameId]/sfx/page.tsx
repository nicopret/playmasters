import Image from 'next/image';
import Link from 'next/link';
import dashStyles from '../../../../components/AdminDashboard/AdminDashboard.module.css';
import {
  getCoreAssetsDraft,
  SPACE_BLASTER_CORE_ASSET_SPECS,
} from '../../../../lib/coreAssets';
import { getGameDisplayName } from '../../../../lib/games';
import SFXComponent from '../../../../components/SFXComponent/SFXComponent';
import styles from './page.module.css';

type GameSfxPageProps = {
  params: Promise<{
    gameId: string;
  }>;
};

const navItems = [
  { label: 'Home', href: '/' },
  { label: 'Announcements', href: '/announcements' },
  { label: 'Games', href: '/games' },
  { label: 'Assets', href: '/assets' },
];

const SPACE_BLASTER_SFX_ENTRIES = [
  { title: 'Player Fire', definitionId: 'sfx.player.fire' },
  { title: 'Enemy Fire', definitionId: 'sfx.enemy.fire' },
  { title: 'Explosion Small', definitionId: 'sfx.explosion.small' },
  { title: 'Explosion Medium', definitionId: 'sfx.explosion.medium' },
  { title: 'Explosion Large', definitionId: 'sfx.explosion.large' },
  { title: 'Hit', definitionId: 'sfx.hit' },
  { title: 'Wave Clear', definitionId: 'sfx.waveClear' },
  { title: 'Tier Up', definitionId: 'sfx.tierUp' },
  { title: 'Game Over', definitionId: 'sfx.gameOver' },
  { title: 'Dive Warning', definitionId: 'sfx.diveWarning' },
];

const LUNAR_DRIFT_SFX_ENTRIES = [
  { title: 'Thruster Feedback', definitionId: 'sfx.player.fire' },
  { title: 'Landing Feedback', definitionId: 'sfx.waveClear' },
  { title: 'Crash Feedback', definitionId: 'sfx.explosion.large' },
  { title: 'Rescue and Delivery Feedback', definitionId: 'sfx.tierUp' },
  { title: 'Fuel Awareness', definitionId: 'sfx.hit' },
  { title: 'Terrain Degradation', definitionId: 'sfx.explosion.medium' },
  { title: 'Music', definitionId: 'sfx.enemy.fire' },
];

const getSfxEntriesForGame = (gameId: string) => {
  if (gameId === 'lander-drift') {
    return LUNAR_DRIFT_SFX_ENTRIES;
  }
  return SPACE_BLASTER_SFX_ENTRIES;
};

export default async function GameSfxPage({ params }: GameSfxPageProps) {
  const { gameId } = await params;
  const gameTitle = getGameDisplayName(gameId);
  const sfxEntries = getSfxEntriesForGame(gameId);
  const draft = await getCoreAssetsDraft(gameId);
  const presetByDefinitionId = new Map(
    draft.definitions.map((definition) => [
      definition.id,
      typeof definition.variables.presetJson === 'string'
        ? definition.variables.presetJson
        : '',
    ]),
  );

  return (
    <div className={dashStyles.shell}>
      <aside className={dashStyles.sidebar}>
        <div className={dashStyles.logoWrap}>
          <Image
            src="/brand/playmaster_logo.png"
            alt="Playmasters logo"
            fill
            sizes="280px"
            className={dashStyles.logo}
            priority
          />
        </div>
        <nav className={dashStyles.menu}>
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={`${dashStyles.menuItem} ${
                item.label === 'Games' ? dashStyles.menuActive : ''
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      <main className={dashStyles.main}>
        <header className={dashStyles.pageHeader}>
          <div className={styles.headingRow}>
            <div className={styles.headingIcon}>
              <Image
                src="/brand/playmaster_logo.png"
                alt=""
                fill
                sizes="28px"
                className={styles.headingIconImage}
              />
            </div>
            <div>
              <h1>{gameTitle} SFX</h1>
              <p className={styles.subtitle}>
                Manage sound effects for this game.
              </p>
            </div>
          </div>
        </header>

        <section className={styles.contentSection}>
          <Link href={`/games/${gameId}`} className={styles.backButton}>
            Back to {gameTitle} admin
          </Link>

          <div className={styles.sfxList}>
            {sfxEntries.map((entry) => {
              const spec = SPACE_BLASTER_CORE_ASSET_SPECS.find(
                (item) => item.id === entry.definitionId,
              );
              const slot = spec?.slots.find((item) => item.media === 'audio');
              if (!slot) return null;

              return (
                <SFXComponent
                  key={entry.definitionId}
                  gameId={gameId}
                  definitionId={entry.definitionId}
                  slotId={slot.slotId}
                  title={entry.title}
                  initialPresetJson={
                    presetByDefinitionId.get(entry.definitionId) ?? ''
                  }
                />
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
