import * as React from 'react';
import styles from './GameTile.module.css';
import { Card } from '../Card/Card';
import { Badge } from '../Badge/Badge';
import { Button } from '../Button/Button';
import { cn } from '../../utils/cn';

export type GameTileStatus = 'available' | 'coming-soon';

export interface GameTileProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  href: string;
  imageUrl?: string;
  tags?: string[];
  status?: GameTileStatus;
  onPlay?: () => void;
}

export const GameTile: React.FC<GameTileProps> = ({
  title,
  href,
  imageUrl,
  tags = [],
  status = 'available',
  onPlay,
  className,
  ...props
}) => {
  const isAvailable = status === 'available';

  const actionButton = () => {
    if (!isAvailable) {
      return (
        <Button variant="secondary" size="sm" disabled aria-disabled>
          Coming soon
        </Button>
      );
    }

    if (onPlay) {
      return (
        <Button variant="primary" size="sm" onClick={onPlay}>
          Play
        </Button>
      );
    }

    return (
      <Button as="a" href={href} variant="primary" size="sm">
        Play
      </Button>
    );
  };

  return (
    <Card className={cn(styles.tile, className)} variant="surface" padding="md" {...props}>
      <div className={styles.imageWrapper}>
        {status === 'coming-soon' ? (
          <div className={styles.statusBadge}>
            <Badge variant="warning" size="sm">
              Coming soon
            </Badge>
          </div>
        ) : null}
        {imageUrl ? (
          <img className={styles.image} src={imageUrl} alt={title} />
        ) : (
          <div className={styles.image} role="presentation" />
        )}
      </div>

      <div className={styles.content}>
        <h3 className={styles.title}>{title}</h3>

        {tags.length ? (
          <div className={styles.tags}>
            {tags.map((tag) => (
              <Badge key={tag} variant="info" size="sm">
                {tag}
              </Badge>
            ))}
          </div>
        ) : null}

        <div className={styles.footer}>
          <a className={styles.playLink} href={href} aria-label={`${title} details`}>
            Details
          </a>
          {actionButton()}
        </div>
      </div>
    </Card>
  );
};
