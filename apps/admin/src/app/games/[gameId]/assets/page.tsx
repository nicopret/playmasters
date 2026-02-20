import Image from 'next/image';
import Link from 'next/link';
import dashStyles from '../../../../components/AdminDashboard/AdminDashboard.module.css';
import CoreAssetsEditor from './CoreAssetsEditor';
import styles from './page.module.css';
import type { CoreAssetKind } from '../../../../lib/coreAssets';
import { getGameDisplayName } from '../../../../lib/games';

type GameAssetsPageProps = {
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

export type SpaceBlasterCoreAssetItem = {
  id: string;
  displayName: string;
  kind: CoreAssetKind;
  category: 'Hero' | 'Enemies' | 'Ammo' | 'VFX' | 'SFX';
  acceptedFileTypes: string[];
};

export const SPACE_BLASTER_CORE_ASSETS: SpaceBlasterCoreAssetItem[] = [
  {
    id: 'hero.playerShip',
    displayName: 'Player Ship',
    kind: 'hero',
    category: 'Hero',
    acceptedFileTypes: ['image/png'],
  },
  {
    id: 'enemy.grunt',
    displayName: 'Grunt',
    kind: 'enemy',
    category: 'Enemies',
    acceptedFileTypes: ['image/png'],
  },
  {
    id: 'enemy.shooter',
    displayName: 'Shooter',
    kind: 'enemy',
    category: 'Enemies',
    acceptedFileTypes: ['image/png'],
  },
  {
    id: 'enemy.tank',
    displayName: 'Tank',
    kind: 'enemy',
    category: 'Enemies',
    acceptedFileTypes: ['image/png'],
  },
  {
    id: 'enemy.fast',
    displayName: 'Fast',
    kind: 'enemy',
    category: 'Enemies',
    acceptedFileTypes: ['image/png'],
  },
  {
    id: 'enemy.elite',
    displayName: 'Elite',
    kind: 'enemy',
    category: 'Enemies',
    acceptedFileTypes: ['image/png'],
  },
  {
    id: 'enemy.boss',
    displayName: 'Boss',
    kind: 'enemy',
    category: 'Enemies',
    acceptedFileTypes: ['image/png'],
  },
  {
    id: 'ammo.player.basic',
    displayName: 'Player Bullet',
    kind: 'ammo',
    category: 'Ammo',
    acceptedFileTypes: ['image/png'],
  },
  {
    id: 'ammo.enemy.basic',
    displayName: 'Enemy Bullet',
    kind: 'ammo',
    category: 'Ammo',
    acceptedFileTypes: ['image/png'],
  },
  {
    id: 'vfx.explosion.small',
    displayName: 'Explosion (Small)',
    kind: 'vfx',
    category: 'VFX',
    acceptedFileTypes: ['image/png'],
  },
  {
    id: 'vfx.explosion.medium',
    displayName: 'Explosion (Medium)',
    kind: 'vfx',
    category: 'VFX',
    acceptedFileTypes: ['image/png'],
  },
  {
    id: 'vfx.explosion.large',
    displayName: 'Explosion (Large)',
    kind: 'vfx',
    category: 'VFX',
    acceptedFileTypes: ['image/png'],
  },
  {
    id: 'vfx.hitSpark',
    displayName: 'Hit Spark',
    kind: 'vfx',
    category: 'VFX',
    acceptedFileTypes: ['image/png'],
  },
  {
    id: 'vfx.diveWarning',
    displayName: 'Dive Warning',
    kind: 'vfx',
    category: 'VFX',
    acceptedFileTypes: ['image/png'],
  },
  {
    id: 'sfx.player.fire',
    displayName: 'SFX: Player Fire',
    kind: 'sfx',
    category: 'SFX',
    acceptedFileTypes: ['audio/wav', 'audio/x-wav', 'audio/mpeg'],
  },
  {
    id: 'sfx.enemy.fire',
    displayName: 'SFX: Enemy Fire',
    kind: 'sfx',
    category: 'SFX',
    acceptedFileTypes: ['audio/wav', 'audio/x-wav', 'audio/mpeg'],
  },
  {
    id: 'sfx.hit',
    displayName: 'SFX: Hit',
    kind: 'sfx',
    category: 'SFX',
    acceptedFileTypes: ['audio/wav', 'audio/x-wav', 'audio/mpeg'],
  },
  {
    id: 'sfx.explosion.small',
    displayName: 'SFX: Explosion (Small)',
    kind: 'sfx',
    category: 'SFX',
    acceptedFileTypes: ['audio/wav', 'audio/x-wav', 'audio/mpeg'],
  },
  {
    id: 'sfx.explosion.large',
    displayName: 'SFX: Explosion (Large)',
    kind: 'sfx',
    category: 'SFX',
    acceptedFileTypes: ['audio/wav', 'audio/x-wav', 'audio/mpeg'],
  },
  {
    id: 'sfx.waveClear',
    displayName: 'SFX: Wave Clear',
    kind: 'sfx',
    category: 'SFX',
    acceptedFileTypes: ['audio/wav', 'audio/x-wav', 'audio/mpeg'],
  },
  {
    id: 'sfx.tierUp',
    displayName: 'SFX: Tier Up',
    kind: 'sfx',
    category: 'SFX',
    acceptedFileTypes: ['audio/wav', 'audio/x-wav', 'audio/mpeg'],
  },
  {
    id: 'sfx.gameOver',
    displayName: 'SFX: Game Over',
    kind: 'sfx',
    category: 'SFX',
    acceptedFileTypes: ['audio/wav', 'audio/x-wav', 'audio/mpeg'],
  },
  {
    id: 'sfx.diveWarning',
    displayName: 'SFX: Dive Warning',
    kind: 'sfx',
    category: 'SFX',
    acceptedFileTypes: ['audio/wav', 'audio/x-wav', 'audio/mpeg'],
  },
];

export default async function GameAssetsPage({ params }: GameAssetsPageProps) {
  const { gameId } = await params;
  const gameTitle = getGameDisplayName(gameId);

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
            <h1>{gameTitle} Assets</h1>
          </div>
        </header>

        <section className={styles.contentSection}>
          <p className={styles.meta}>
            Manage core gameplay assets for catalogs (Hero, Enemy, Ammo, VFX,
            SFX).
          </p>
          <CoreAssetsEditor
            gameId={gameId}
            scaffoldItems={SPACE_BLASTER_CORE_ASSETS}
          />
          <Link href={`/games/${gameId}`} className={styles.link}>
            Back to {gameTitle} admin
          </Link>
        </section>
      </main>
    </div>
  );
}
