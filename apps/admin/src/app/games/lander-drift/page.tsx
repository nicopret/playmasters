import Image from 'next/image';
import Link from 'next/link';
import dashStyles from '../../../components/AdminDashboard/AdminDashboard.module.css';
import styles from './page.module.css';

const navItems = [
  { label: 'Home', href: '/' },
  { label: 'Announcements', href: '/announcements' },
  { label: 'Games', href: '/games' },
  { label: 'Assets', href: '/assets' },
];

export default function LunarDriftPage() {
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
          <h1>Lunar Drift</h1>
        </header>

        <section className={styles.contentSection}>
          <p className={styles.meta}>
            Manage assets and tuning for Lunar Drift.
          </p>
          <div className={styles.actions}>
            <Link href="/games/lander-drift/assets" className={styles.primary}>
              Assets
            </Link>
            <Link href="/games/lander-drift/sfx" className={styles.primary}>
              Audio / SFX
            </Link>
            <button
              type="button"
              className={styles.secondary}
              disabled
              title="Physics / Config is coming soon."
            >
              Physics / Config
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
