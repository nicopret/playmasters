'use client';

import React from 'react';
import styles from './InputField.module.css';

export type InputFieldProps = {
  title: string;
  name?: string;
  value?: string;
  required?: boolean;
};

const InputField: React.FC<InputFieldProps> = ({ title, name, value, required }) => {
  return (
    <label className={styles.wrapper}>
      <span className={styles.label}>{title}</span>
      <input
        className={styles.input}
        type="text"
        name={name}
        defaultValue={value ?? ''}
        required={required}
      />
    </label>
  );
};

export default InputField;
