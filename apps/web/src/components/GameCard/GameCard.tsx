import Link from 'next/link';
import { Badge, Button, Card } from '@playmasters/ui';
import type { Game } from '../../lib/games';
import styles from './GameCard.module.css';

type Props = {
  game: Game;
};

const statusBadgeVariant = (status: Game['status']) =>
  status === 'available' ? 'success' : 'warning';

const statusLabel = (status: Game['status']) =>
  status === 'available' ? 'Available' : 'Coming soon';

export const GameCard = ({ game }: Props) => {
  const isAvailable = game.status === 'available';
  const href = `/games/${game.slug}`;

  return (
    <Card className={styles.card} variant="surface" padding="lg">
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <h3 className={styles.title}>{game.title}</h3>
          <Badge variant={statusBadgeVariant(game.status)} size="sm">
            {statusLabel(game.status)}
          </Badge>
        </div>
        <p className={styles.description}>{game.description}</p>
      </div>

      <div className={styles.tags}>
        {game.tags.map((tag) => (
          <Badge key={tag} variant="info" size="sm">
            {tag}
          </Badge>
        ))}
      </div>

      <div className={styles.footer}>
        <Link href={href}>Details</Link>
        <div className={styles.cta}>
          <Button as="a" href={href} variant={isAvailable ? 'primary' : 'secondary'} size="sm" disabled={!isAvailable}>
            {isAvailable ? 'Play' : 'Coming soon'}
          </Button>
        </div>
      </div>
    </Card>
  );
};
