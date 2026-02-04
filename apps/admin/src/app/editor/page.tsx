import styles from '../page.module.css';

export const dynamic = 'force-dynamic';

export default function EditorLandingPage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.kicker}>Image Editor</div>
        <h1 className={styles.title}>Image Editor</h1>
        <p className={styles.subtitle}>
          Manage branded assets, upload new versions, and track previews.
        </p>
      </header>

      <nav className={styles.nav}>
        <a className={styles.navCard} href="/editor/images">
          <div className={styles.navLabel}>Assets</div>
          <span className={styles.chevron}>→</span>
        </a>
        <a className={styles.navCard} href="/editor/images/new">
          <div className={styles.navLabel}>Upload New</div>
          <span className={styles.chevron}>→</span>
        </a>
      </nav>
    </div>
  );
}
