import Image from 'next/image';
import Link from 'next/link';
import dashStyles from '../../../../components/AdminDashboard/AdminDashboard.module.css';
import AstroDefenderConfigEditor from '../../../../components/AstroDefenderConfig/AstroDefenderConfigEditor';
import styles from './page.module.css';

const navItems = [
  { label: 'Home', href: '/' },
  { label: 'Announcements', href: '/announcements' },
  { label: 'Games', href: '/games' },
  { label: 'Assets', href: '/assets' },
];

export default function AstroDefenderConfigPage() {
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
          <h1>Astro Defender Runtime Config</h1>
        </header>

        <section className={styles.contentSection}>
          <p className={styles.meta}>
            Edit seeded gameplay defaults for wave pacing, enemies, defended
            assets, scoring, and difficulty scaling.
          </p>
          <Link href="/games/astro-defender" className={styles.backLink}>
            Back to Astro Defender
          </Link>
          <AstroDefenderConfigEditor />
        </section>
      </main>
    </div>
  );
}
