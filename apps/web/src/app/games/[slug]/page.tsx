import { Badge, Container } from '@playmasters/ui';
import { notFound } from 'next/navigation';
import { auth } from '../../../auth';
import { getGameBySlug } from '../../../lib/games';
import { LeaderboardPanel } from '../../../components/LeaderboardPanel/LeaderboardPanel';
import { GameHost } from '../../../components/GameHost/GameHost';
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
  const session = await auth();

  if (!game) {
    return notFound();
  }

  const realtimeWsUrl = process.env.NEXT_PUBLIC_REALTIME_WS_URL ?? 'ws://localhost:4000';
  const apiBaseUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    (process.env.NODE_ENV === 'development' ? 'http://localhost:3001' : '');
  const countryCode =
    process.env.NEXT_PUBLIC_DEFAULT_COUNTRY_CODE ??
    process.env.DEFAULT_COUNTRY_CODE ??
    'GB';

  const user = session?.user?.id
    ? {
        id: session.user.id,
        displayName: session.user.name ?? session.user.email ?? 'Player',
      }
    : undefined;

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
            {game.status === 'available' ? (
              <GameHost
                gameId={game.id}
                gameTitle={game.title}
                realtimeWsUrl={realtimeWsUrl}
                apiBaseUrl={apiBaseUrl}
                countryCode={countryCode}
                user={user}
              />
            ) : (
              <div className={styles.placeholder}>
                <div className={styles.stageText}>
                  <span>Coming soon</span>
                </div>
              </div>
            )}
          </div>

          <LeaderboardPanel game={game} />
        </div>
      </Container>
    </div>
  );
};

export default GameDetailPage;
