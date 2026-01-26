import * as React from 'react';
import styles from './Input.module.css';
import { cn } from '../../utils/cn';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  rightSlot?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, rightSlot, id, className, ...props },
  ref
) {
  const internalId = React.useId();
    const inputId = id ?? `pm-input-${internalId}`;

    const describedBy: string[] = [];
    if (hint) describedBy.push(`${inputId}-hint`);
    if (error) describedBy.push(`${inputId}-error`);

    return (
      <div className={styles.field}>
        {label ? (
          <div className={styles.labelRow}>
            <label htmlFor={inputId} className={styles.label}>
              {label}
            </label>
          </div>
        ) : null}
        <div className={styles.inputWrapper}>
          <input
            id={inputId}
            ref={ref}
            className={cn(
              styles.input,
              !!rightSlot && styles.withRightSlot,
              error && styles.inputError,
              className
            )}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={describedBy.join(' ') || undefined}
            {...props}
          />
          {rightSlot && !label && (
            <span className={styles.rightSlot} aria-hidden>
              {rightSlot}
            </span>
          )}
        </div>
        {hint && !error ? (
          <p id={`${inputId}-hint`} className={styles.hint}>
            {hint}
          </p>
        ) : null}
        {error ? (
          <p id={`${inputId}-error`} className={styles.error}>
            {error}
          </p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';
