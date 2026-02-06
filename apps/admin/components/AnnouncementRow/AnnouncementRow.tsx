'use client';

import React from 'react';
import styles from './AnnouncementRow.module.css';

export type AnnouncementRowProps = {
  id: string;
  title: string;
  isVisible: boolean;
  onToggleVisible: (id: string, next: boolean) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
};

const AnnouncementRow: React.FC<AnnouncementRowProps> = ({
  id,
  title,
  isVisible,
  onToggleVisible,
  onEdit,
  onDelete,
}) => {
  return (
    <div className={`${styles.row}`}>
      <input
        type="checkbox"
        className={styles.checkbox}
        checked={isVisible}
        onChange={(e) => onToggleVisible(id, e.target.checked)}
      />
      <div className={styles.title}>{title}</div>
      <div className={styles.actions}>
        <button type="button" className={styles.btn} onClick={() => onEdit(id)}>
          Edit
        </button>
        <button type="button" className={styles.btn} onClick={() => onDelete(id)}>
          Delete
        </button>
      </div>
    </div>
  );
};

export default AnnouncementRow;
