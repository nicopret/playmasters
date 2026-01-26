'use client';
import { Button, Carousel, Container, GameTile, Badge } from '@playmasters/ui';
import styles from './page.module.css';

const announcements = [
  {
    id: '1',
    title: 'Season 1: Neon Gauntlet',
    body: 'Daily tournaments, fresh maps, and leaderboard resets every Sunday.',
    imageUrl:
      'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1200&q=80',
    ctaLabel: 'View schedule',
    ctaHref: '#',
  },
  {
    id: '2',
    title: 'Creator Spotlight',
    body: 'Community-built arenas rotating weekly. Submit yours to get featured.',
    imageUrl:
      'https://images.unsplash.com/photo-1478720568477-152d9b164e26?auto=format&fit=crop&w=1200&q=80',
    ctaLabel: 'Submit a map',
    ctaHref: '#',
  },
  {
    id: '3',
    title: 'Co-op Raids',
    body: 'Team up, beat the boss, and unlock limited neon cosmetics.',
    imageUrl:
      'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80',
    ctaLabel: 'Form a squad',
    ctaHref: '#',
  },
];

const games = [
  { title: 'Neon Drift', tags: ['Racing', 'Arcade'] },
  { title: 'Quantum Clash', tags: ['Arena', '3v3'] },
  { title: 'Skyline Run', tags: ['Runner'] },
  { title: 'Synthwave Nights', tags: ['Music'] },
  { title: 'Turbo Trails', tags: ['Time Trial'] },
  { title: 'Holo Blocks', tags: ['Puzzle'] },
];

export default function Page() {
  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <Container>
          <Carousel items={announcements} />
        </Container>
      </section>

      <section className={styles.section}>
        <Container>
          <div className={styles.sectionHeader}>
            <p className={styles.kicker}>What is Playmasters?</p>
            <h2 className={styles.heading}>Arcade-grade cloud gaming, built for competition.</h2>
            <p className={styles.lead}>
              Pick a game, launch instantly, and climb the global ladder with live events every week.
            </p>
          </div>
          <div className={styles.steps}>
            <div className={styles.stepCard}>
              <span className={styles.stepBadge}>1</span>
              <h3>Choose a game</h3>
              <p>Browse rotating arcade and creator-made titles curated for high replayability.</p>
            </div>
            <div className={styles.stepCard}>
              <span className={styles.stepBadge}>2</span>
              <h3>Play instantly</h3>
              <p>Zero installs. Low-latency cloud sessions tuned for fast inputs and neon visuals.</p>
            </div>
            <div className={styles.stepCard}>
              <span className={styles.stepBadge}>3</span>
              <h3>Climb the leaderboard</h3>
              <p>Submit runs, earn badges, and qualify for weekend finals with your crew.</p>
            </div>
          </div>
        </Container>
      </section>

      <section className={styles.section}>
        <Container>
          <div className={styles.sectionHeader}>
            <p className={styles.kicker}>Games</p>
            <h2 className={styles.heading}>Coming soon to the arena</h2>
          </div>
          <div className={styles.gameGrid}>
            {games.map((game) => (
              <GameTile
                key={game.title}
                title={game.title}
                href="#"
                tags={game.tags}
                status="coming-soon"
                imageUrl={undefined}
              />
            ))}
          </div>
        </Container>
      </section>

      <section className={styles.section}>
        <Container>
          <div className={styles.social}>
            <div>
              <p className={styles.kicker}>Community</p>
              <h2 className={styles.heading}>Join the signal</h2>
              <p className={styles.lead}>
                Follow our drops, weekend events, and creator spotlights. Your squad is waiting.
              </p>
              <div className={styles.socialBadges}>
                <Badge variant="info">Discord</Badge>
                <Badge variant="warning">Twitch</Badge>
                <Badge variant="success">YouTube</Badge>
                <Badge variant="danger">X / Twitter</Badge>
              </div>
            </div>
            <Button as="a" href="#" variant="primary" size="lg">
              Join community
            </Button>
          </div>
        </Container>
      </section>
    </div>
  );
}
