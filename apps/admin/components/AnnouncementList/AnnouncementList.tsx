'use client';

import React from 'react';
import Link from 'next/link';
import AnnouncementRow from '../AnnouncementRow/AnnouncementRow';
import styles from './AnnouncementList.module.css';

export type AnnouncementListProps = {
  items: { id: string; title: string; isVisible: boolean }[];
  onToggleVisible: (id: string, next: boolean) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
};

const AnnouncementList: React.FC<AnnouncementListProps> = ({
  items,
  onToggleVisible,
  onEdit,
  onDelete,
}) => {
  return (
    <div className={styles.list}>
      <div className={styles.header}>
        <Link href="/announcements/new" className={styles.addBtn} aria-label="Add announcement">
          +
        </Link>
      </div>
      {items.map((item) => (
        <AnnouncementRow
          key={item.id}
          {...item}
          onToggleVisible={onToggleVisible}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
};

export default AnnouncementList;
