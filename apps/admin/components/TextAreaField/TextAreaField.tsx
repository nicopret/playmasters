'use client';

import React from 'react';
import styles from './TextAreaField.module.css';

export type TextAreaFieldProps = {
  title: string;
  name?: string;
  value?: string;
  required?: boolean;
};

const TextAreaField: React.FC<TextAreaFieldProps> = ({ title, name, value, required }) => {
  return (
    <label className={styles.wrapper}>
      <span className={styles.label}>{title}</span>
      <textarea
        className={styles.input}
        name={name}
        defaultValue={value ?? ''}
        required={required}
      />
    </label>
  );
};

export default TextAreaField;
