import { Container } from '@playmasters/ui';
import { getAllGames } from '../../lib/games';
import { GameCard } from '../../components/GameCard/GameCard';
import styles from './page.module.css';

export const dynamic = 'force-static';

const GamesPage = () => {
  const games = getAllGames();

  return (
    <div className={styles.page}>
      <Container>
        <div className={styles.header}>
          <h1 className={styles.title}>Games</h1>
          <p className={styles.subtitle}>Choose a game and climb the leaderboards.</p>
        </div>
        <div className={styles.grid}>
          {games.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
        </div>
      </Container>
    </div>
  );
};

export default GamesPage;
