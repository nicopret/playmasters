import Link from 'next/link';
import Image from 'next/image';
import InfoBlock from '../../../components/InfoBlock/InfoBlock';
import AnnouncementListContainer from '../../../components/AnnouncementList/AnnouncementListContainer';
import { listAnnouncements } from '../../../lib/announcements';
import dashStyles from '../../components/AdminDashboard/AdminDashboard.module.css';
import styles from './page.module.css';

function buildKpis(activeCount: number) {
  return [
    {
      title: 'Active Announcements',
      value: activeCount.toString(),
      fontColor: '#ffffff',
      titleBgColor: '#2f62be',
      valueBgColor: '#9cbaf2',
      footerBgColor: '#c7dbff',
    },
    {
      title: 'Announcements Clicks',
      value: '1,000',
      data: [18, 22, 26, 30, 34, 28, 26, 32, 36, 30, 28, 24, 22, 26, 28, 30, 32, 34],
      fontColor: '#ffffff',
      titleBgColor: '#0b6b2b',
      valueBgColor: '#5bb77a',
      footerBgColor: '#d5e7d9',
    },
    {
      title: 'Daily Play Hours',
      value: '150,000',
      data: [40, 44, 46, 48, 50, 46, 44, 42, 40, 38, 36, 38, 40, 42, 44, 46, 48, 50],
      fontColor: '#ffffff',
      titleBgColor: '#d4a100',
      valueBgColor: '#fde694',
      footerBgColor: '#f9f3d6',
    },
    {
      title: 'Registered Players',
      value: '50,000',
      data: [18, 22, 24, 26, 28, 26, 24, 22, 20, 18, 22, 26, 30, 34, 32, 28, 24, 22],
      fontColor: '#ffffff',
      titleBgColor: '#b91c1c',
      valueBgColor: '#f4b4b4',
      footerBgColor: '#f8dddd',
    },
  ];
}

export default async function AnnouncementsPage() {
  const announcements = await listAnnouncements();
  const items = announcements.map((a) => ({
    id: a.id,
    title: a.title,
    isVisible: a.isActive,
  }));
  const activeCount = announcements.filter((a) => a.isActive).length;
  const kpiConfigs = buildKpis(activeCount);

  const activeNav = [
    { label: 'Home', href: '/' },
    { label: 'Announcements', href: '/announcements' },
    { label: 'Games', href: '/games' },
    { label: 'Assets', href: '/assets' },
  ];

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
          {activeNav.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={`${dashStyles.menuItem} ${
                item.label === 'Announcements' ? dashStyles.menuActive : ''
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      <main className={dashStyles.main}>
        <header className={dashStyles.pageHeader}>
          <h1>Announcement Admin</h1>
        </header>

        <section className={dashStyles.kpiRow}>
          {kpiConfigs.map((block) => (
            <div key={block.title} className={dashStyles.kpiItem}>
              <InfoBlock {...block} />
            </div>
          ))}
        </section>

        <section className={styles.listSection}>
          <AnnouncementListContainer initialItems={items} />
        </section>
      </main>
    </div>
  );
}
