import Link from 'next/link';
import Image from 'next/image';
import dashStyles from '../../../components/AdminDashboard/AdminDashboard.module.css';
import { getGameDisplayName } from '../../../lib/games';
import PublishButton from './PublishButton';
import styles from './page.module.css';

type GamePageProps = {
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

export default async function GamePage({ params }: GamePageProps) {
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
          <h1>{gameTitle} Admin Page</h1>
        </header>

        <section className={styles.contentSection}>
          <h2 className={styles.gameTitle}>{gameId}</h2>
          <p className={styles.meta}>Game admin entry point.</p>
          <PublishButton gameId={gameId} />
          <br />
          <Link href={`/games/${gameId}/levels`} className={styles.link}>
            Open levels
          </Link>
          <br />
          <Link href={`/games/${gameId}/assets`} className={styles.link}>
            Open game assets
          </Link>
          <br />
          <Link href={`/games/${gameId}/history`} className={styles.link}>
            Open publish history
          </Link>
          <br />
          <Link href={`/games/${gameId}/score-config`} className={styles.link}>
            Open score config
          </Link>
          <br />
          <Link href={`/games/${gameId}/sfx`} className={styles.link}>
            Open game SFX
          </Link>
        </section>
      </main>
    </div>
  );
}
