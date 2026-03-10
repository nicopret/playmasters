import Image from 'next/image';
import Link from 'next/link';
import dashStyles from '../../../../components/AdminDashboard/AdminDashboard.module.css';
import LanderDriftTestSetup from '../../../../components/LanderDriftTest/LanderDriftTestSetup';
import styles from './page.module.css';

const navItems = [
  { label: 'Home', href: '/' },
  { label: 'Announcements', href: '/announcements' },
  { label: 'Games', href: '/games' },
  { label: 'Assets', href: '/assets' },
];

export default function LanderDriftTestSetupPage() {
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
          <h1>Lunar Drift Test Setup</h1>
          <p className={styles.meta}>
            Select a test scenario and physics configuration, then launch the
            game in test mode.
          </p>
        </header>
        <section className={styles.contentSection}>
          <LanderDriftTestSetup />
        </section>
      </main>
    </div>
  );
}
