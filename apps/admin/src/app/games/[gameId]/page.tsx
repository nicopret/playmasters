import Link from 'next/link';
import Image from 'next/image';
import dashStyles from '../../../components/AdminDashboard/AdminDashboard.module.css';
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
  const gameTitle = gameId
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

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
          <Link href={`/games/${gameId}/levels/demo`} className={styles.link}>
            Open demo level
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
        </section>
      </main>
    </div>
  );
}
