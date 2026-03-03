'use client';

import { FormEvent, useEffect, useState } from 'react';
import styles from './UploadNameModal.module.css';

type UploadNameModalProps = {
  isOpen: boolean;
  onConfirm: (assetName: string) => void;
  onCancel: () => void;
};

export default function UploadNameModal({
  isOpen,
  onConfirm,
  onCancel,
}: UploadNameModalProps) {
  const [assetName, setAssetName] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setAssetName('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = assetName.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
  };

  return (
    <div
      className={styles.overlay}
      role="presentation"
      onClick={() => onCancel()}
      aria-hidden="true"
    >
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-name-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="upload-name-modal-title" className={styles.title}>
          Name Asset
        </h3>
        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.field}>
            <span>Asset Name</span>
            <input
              autoFocus
              className={styles.input}
              value={assetName}
              onChange={(event) => setAssetName(event.target.value)}
              placeholder="Enter asset name"
            />
          </label>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={() => onCancel()}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={styles.confirmButton}
              disabled={!assetName.trim()}
            >
              Confirm
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
