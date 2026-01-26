import * as React from 'react';
import styles from './Badge.module.css';
import { cn } from '../../utils/cn';

type BadgeVariant = 'default' | 'info' | 'success' | 'warning' | 'danger';
type BadgeSize = 'sm' | 'md';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { variant = 'default', size = 'md', className, children, ...props },
  ref
) {
  return (
    <span
      ref={ref}
      className={cn(styles.badge, styles[variant], styles[`size-${size}`], className)}
      {...props}
    >
      {children}
    </span>
  );
});

Badge.displayName = 'Badge';
