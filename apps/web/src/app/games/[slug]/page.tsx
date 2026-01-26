import { Badge, Container } from '@playmasters/ui';
import { notFound } from 'next/navigation';
import { getGameBySlug } from '../../../lib/games';
import { getMockLeaderboardsForGame } from '../../../lib/mockLeaderboards';
import { LeaderboardPanel } from '../../../components/LeaderboardPanel/LeaderboardPanel';
import styles from './page.module.css';

type PageProps = {
  params: Promise<{ slug: string }>;
};

const statusBadgeVariant = (status: 'available' | 'coming-soon') =>
  status === 'available' ? 'success' : 'warning';

const statusLabel = (status: 'available' | 'coming-soon') =>
  status === 'available' ? 'Available' : 'Coming soon';

const GameDetailPage = async ({ params }: PageProps) => {
  const { slug } = await params;
  const game = getGameBySlug(slug);

  if (!game) {
    return notFound();
  }

  const leaderboardData = getMockLeaderboardsForGame(game);

  return (
    <div className={styles.page}>
      <Container>
        <div className={styles.header}>
          <h1 className={styles.title}>{game.title}</h1>
          <p className={styles.description}>{game.description}</p>
          <div className={styles.meta}>
            <Badge variant={statusBadgeVariant(game.status)}>{statusLabel(game.status)}</Badge>
            {game.tags.map((tag) => (
              <Badge key={tag} variant="info" size="sm">
                {tag}
              </Badge>
            ))}
          </div>
        </div>

        <div className={styles.layout}>
          <div className={styles.stage}>
            <div className={styles.stageText}>
              <span>Game loads here</span>
              {game.status === 'coming-soon' ? <span>Coming soon</span> : <span>Ready to play</span>}
            </div>
          </div>

          <LeaderboardPanel game={game} data={leaderboardData} />
        </div>
      </Container>
    </div>
  );
};

export default GameDetailPage;
