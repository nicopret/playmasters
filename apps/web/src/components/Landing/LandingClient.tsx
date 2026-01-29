'use client';

import { Button, Carousel, Container, GameTile, Badge } from '@playmasters/ui';
import type { Announcement } from '@playmasters/types';
import styles from '../../app/page.module.css';

type Game = { title: string; tags: string[] };

type Props = {
  announcements: Announcement[];
  fallbackAnnouncements: Announcement[];
  games: Game[];
};

export function LandingClient({ announcements, fallbackAnnouncements, games }: Props) {
  const carouselItems = (announcements.length ? announcements : fallbackAnnouncements).map(
    (item) => ({
      id: item.id,
      title: item.title,
      body: item.body,
      imageUrl: item.imageUrl,
      ctaLabel: item.ctaLabel,
      ctaHref: item.ctaHref,
    })
  );

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <Container>
          <Carousel items={carouselItems} />
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
