import * as React from 'react';
import styles from './Button.module.css';
import { cn } from '../../utils/cn';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

type CommonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
};

type ButtonAsButton = CommonProps &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'type'> & {
    as?: 'button';
    type?: React.ButtonHTMLAttributes<HTMLButtonElement>['type'];
  };

type ButtonAsAnchor = CommonProps &
  React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    as: 'a';
  };

export type ButtonProps = ButtonAsButton | ButtonAsAnchor;

export const Button = React.forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(
  function Button(props, ref) {
    const {
      variant = 'primary',
      size = 'md',
      fullWidth,
      loading,
      leftIcon,
      rightIcon,
      className,
      children,
      as = 'button',
      ...rest
    } = props;

    const classes = cn(
      styles.button,
      styles[variant],
      styles[`size-${size}`],
      fullWidth && styles.fullWidth,
      (loading || (rest as { disabled?: boolean }).disabled) && styles.disabled,
      loading && styles.loading,
      className
    );

    const content = (
      <span className={styles.content}>
        {loading && <span className={styles.spinner} aria-hidden="true" />}
        {!loading && leftIcon}
        <span>{children}</span>
        {!loading && rightIcon}
      </span>
    );

    if (as === 'a') {
      const anchorProps = rest as React.AnchorHTMLAttributes<HTMLAnchorElement>;
      return (
        <a
          ref={ref as React.Ref<HTMLAnchorElement>}
          className={classes}
          aria-busy={loading || undefined}
          {...anchorProps}
        >
          {content}
        </a>
      );
    }

    const { type = 'button', disabled, ...buttonProps } =
      rest as React.ButtonHTMLAttributes<HTMLButtonElement>;

    return (
      <button
        ref={ref as React.Ref<HTMLButtonElement>}
        type={type}
        className={classes}
        aria-busy={loading || undefined}
        disabled={disabled || loading}
        {...buttonProps}
      >
        {content}
      </button>
    );
  }
);

Button.displayName = 'Button';
