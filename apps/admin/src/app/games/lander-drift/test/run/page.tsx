import Image from 'next/image';
import Link from 'next/link';
import { Suspense } from 'react';
import dashStyles from '../../../../../components/AdminDashboard/AdminDashboard.module.css';
import LanderDriftTestRunner from '../../../../../components/LanderDriftTest/LanderDriftTestRunner';
import styles from './page.module.css';

const navItems = [
  { label: 'Home', href: '/' },
  { label: 'Announcements', href: '/announcements' },
  { label: 'Games', href: '/games' },
  { label: 'Assets', href: '/assets' },
];

export default function LanderDriftTestRunPage() {
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
          <h1>Lunar Drift Test Runner</h1>
          <p className={styles.meta}>
            Admin test harness with selected scenario and config source.
          </p>
        </header>
        <section className={styles.contentSection}>
          <Suspense
            fallback={<div className={styles.meta}>Loading test runner...</div>}
          >
            <LanderDriftTestRunner />
          </Suspense>
        </section>
      </main>
    </div>
  );
}
