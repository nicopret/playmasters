import Image from 'next/image';
import Link from 'next/link';
import dashStyles from '../../../../components/AdminDashboard/AdminDashboard.module.css';
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

const SFX_ENTRIES = [
  'Player Fire',
  'Enemy Fire',
  'Explosion Small',
  'Explosion Medium',
  'Explosion Large',
];

export default async function GameSfxPage({ params }: GameSfxPageProps) {
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
            {SFX_ENTRIES.map((entry) => (
              <SFXComponent key={entry} title={entry} />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
