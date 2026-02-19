import Image from 'next/image';
import Link from 'next/link';
import dashStyles from '../../../../components/AdminDashboard/AdminDashboard.module.css';
import AssetComponent from '../../../../../components/AssetComponent/AssetComponent';
import styles from './page.module.css';

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

export default async function GameAssetsPage({ params }: GameAssetsPageProps) {
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
          <p className={styles.meta}>Manage game-specific assets here.</p>
          <div className={styles.assetWrap}>
            <AssetComponent />
          </div>
          <Link href={`/games/${gameId}`} className={styles.link}>
            Back to {gameTitle} admin
          </Link>
        </section>
      </main>
    </div>
  );
}
