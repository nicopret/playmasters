import * as React from 'react';
import styles from './Card.module.css';
import { cn } from '../../utils/cn';

export type CardVariant = 'surface' | 'outline' | 'glow';
export type CardPadding = 'sm' | 'md' | 'lg';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: CardPadding;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(function Card(
  { variant = 'surface', padding = 'md', className, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      className={cn(styles.card, styles[variant], styles[`padding-${padding}`], className)}
      {...props}
    />
  );
});

Card.displayName = 'Card';
