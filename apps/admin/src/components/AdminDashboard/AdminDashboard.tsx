import Image from 'next/image';
import InfoBlock from '../../../components/InfoBlock/InfoBlock';
import PieChartPanel from '../../../components/PieChartPanel/PieChartPanel';
import WorldMapPanel from '../../../components/WorldMapPanel/WorldMapPanel';
import styles from './AdminDashboard.module.css';

const activePlayersData = [
  22, 35, 40, 28, 30, 26, 44, 48, 36, 32, 50, 55, 60, 42, 38, 46, 58, 62, 45,
  40, 37, 34, 49, 53, 60, 57, 52, 48, 44, 38, 35, 30, 28, 26,
];

const dailyIncomeData = [
  12, 18, 24, 22, 30, 28, 40, 52, 48, 36, 30, 26, 24, 38, 46, 60, 68, 72, 64,
  58, 52, 46, 42, 40, 36, 30, 26, 30, 34, 42, 46, 52, 58, 50,
];

const playHoursData = [
  50, 60, 55, 70, 80, 75, 90, 110, 105, 95, 85, 80, 78, 82, 96, 120, 130, 128,
  122, 118, 112, 108, 104, 100, 96, 92, 88, 90, 94, 98, 100, 102, 108, 112,
  116, 120,
];

const registeredPlayersData = [
  10, 14, 18, 16, 20, 24, 30, 36, 32, 28, 26, 24, 22, 26, 30, 34, 42, 48, 44,
  40, 38, 36, 34, 32, 30, 28, 26, 28, 32, 36, 40, 44, 46, 48,
];

const kpiBlocks = [
  {
    title: 'Active Players',
    value: '10,000',
    data: activePlayersData,
    fontColor: '#ffffff',
    titleBgColor: '#1d4ed8',
    valueBgColor: '#cce0ff',
    footerBgColor: '#e9f1ff',
  },
  {
    title: 'Daily £ Income',
    value: '1,000',
    data: dailyIncomeData,
    fontColor: '#ffffff',
    titleBgColor: '#0b6b2b',
    valueBgColor: '#5bb77a',
    footerBgColor: '#d5e7d9',
  },
  {
    title: 'Daily Play Hours',
    value: '150,000',
    data: playHoursData,
    fontColor: '#ffffff',
    titleBgColor: '#d4a100',
    valueBgColor: '#fde694',
    footerBgColor: '#f9f3d6',
  },
  {
    title: 'Registered Players',
    value: '50,000',
    data: registeredPlayersData,
    fontColor: '#ffffff',
    titleBgColor: '#b91c1c',
    valueBgColor: '#f4b4b4',
    footerBgColor: '#f8dddd',
  },
];

const playersPerGameRaw = [
  { label: 'Game A', value: 1000 },
  { label: 'Game B', value: 1250 },
  { label: 'Game C', value: 750 },
  { label: 'Game D', value: 2000 },
  { label: 'Game E', value: 2000 },
  { label: 'Game F', value: 500 },
  { label: 'Game G', value: 1400 },
  { label: 'Game H', value: 900 },
  { label: 'Game I', value: 600 },
];

const minutesPerGameRaw = [
  { label: 'Game A', value: 20000 },
  { label: 'Game B', value: 25000 },
  { label: 'Game C', value: 15000 },
  { label: 'Game D', value: 45000 },
  { label: 'Game E', value: 45000 },
  { label: 'Game F', value: 10000 },
  { label: 'Game G', value: 18000 },
  { label: 'Game H', value: 12000 },
  { label: 'Game I', value: 9000 },
];

function preparePieData(items: { label: string; value: number }[]) {
  const sorted = [...items].sort((a, b) => {
    if (b.value !== a.value) return b.value - a.value;
    return a.label.localeCompare(b.label);
  });
  const top = sorted.slice(0, 7);
  const remainder = sorted.slice(7);
  if (remainder.length) {
    const otherTotal = remainder.reduce((sum, item) => sum + item.value, 0);
    top.push({ label: 'Other', value: otherTotal });
  }
  return top;
}

const playersPerGameData = preparePieData(playersPerGameRaw);
const minutesPerGameData = preparePieData(minutesPerGameRaw);

const countryHeatmapData = [
  { countryCode: 'US', value: 5000 },
  { countryCode: 'GB', value: 1200 },
  { countryCode: 'DE', value: 900 },
  { countryCode: 'FR', value: 850 },
  { countryCode: 'ES', value: 400 },
  { countryCode: 'IT', value: 700 },
  { countryCode: 'ZA', value: 300 },
  { countryCode: 'NG', value: 250 },
  { countryCode: 'IN', value: 2200 },
  { countryCode: 'BR', value: 1300 },
  { countryCode: 'AU', value: 600 },
  { countryCode: 'CA', value: 1100 },
  { countryCode: 'JP', value: 1500 },
  { countryCode: 'MX', value: 500 },
  { countryCode: 'SE', value: 200 },
];

export default function AdminDashboard() {
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.logoWrap}>
          <Image
            src="/brand/playmaster_logo.png"
            alt="Playmasters logo"
            fill
            sizes="280px"
            className={styles.logo}
            priority
          />
        </div>
        <nav className={styles.menu}>
          {['Home', 'Announcements', 'Games', 'Assets'].map((item) => (
            <div
              key={item}
              className={`${styles.menuItem} ${item === 'Home' ? styles.menuActive : ''}`}
            >
              {item}
            </div>
          ))}
        </nav>
      </aside>

      <main className={styles.main}>
        <header className={styles.pageHeader}>
          <h1>Admin Console</h1>
        </header>

        <section className={styles.kpiRow}>
          {kpiBlocks.map((block) => (
            <div key={block.title} className={styles.kpiItem}>
              <InfoBlock {...block} />
            </div>
          ))}
        </section>

        <section className={styles.midRow}>
          <PieChartPanel
            title="Players per Game"
            data={playersPerGameData}
            titleBgColor="#5a5a5a"
            pieAreaBgColor="#e6e6e6"
            legendBgColor="#a7a7a7"
          />
          <PieChartPanel
            title="Player Minutes per Game"
            data={minutesPerGameData}
            titleBgColor="#1f1f1f"
            pieAreaBgColor="#f3e5e5"
            legendBgColor="#6f5f5f"
          />
        </section>

        <section className={styles.mapPanel}>
          <WorldMapPanel
            title="Players per Country"
            data={countryHeatmapData}
            titleBgColor="#0b6b2a"
            bodyBgColor="#e6e6e6"
            footerBgColor="#b7c8be"
          />
        </section>
      </main>
    </div>
  );
}
