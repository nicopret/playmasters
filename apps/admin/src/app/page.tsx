import styles from './page.module.css';

const links = [
  { href: '/announcements', label: 'Announcements' },
  { href: '/scores', label: 'Scores (soon)' },
  { href: '/games', label: 'Games (soon)' },
];

export default function AdminHome() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.kicker}>Playmasters</div>
        <h1 className={styles.title}>Admin Console</h1>
        <p className={styles.subtitle}>Manage announcements and live content.</p>
      </header>

      <nav className={styles.nav}>
        {links.map((link) => (
          <a key={link.href} href={link.href} className={styles.navCard}>
            <div className={styles.navLabel}>{link.label}</div>
            <span className={styles.chevron}>→</span>
          </a>
        ))}
      </nav>
    </div>
  );
}
