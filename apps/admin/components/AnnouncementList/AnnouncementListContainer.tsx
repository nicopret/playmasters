'use client';

import React, { useOptimistic, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  deleteAnnouncementAction,
  toggleAnnouncementVisible,
} from '../../lib/announcement-actions';
import AnnouncementList from './AnnouncementList';

type Item = { id: string; title: string; isVisible: boolean };

type Props = {
  initialItems: Item[];
};

const AnnouncementListContainer: React.FC<Props> = ({ initialItems }) => {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [optimisticItems, setOptimisticItems] = useOptimistic(initialItems);

  const handleToggle = (id: string, next: boolean) => {
    startTransition(async () => {
      setOptimisticItems((prev) => prev.map((i) => (i.id === id ? { ...i, isVisible: next } : i)));
      await toggleAnnouncementVisible(id, next);
      setOptimisticItems((prev) => prev.map((i) => (i.id === id ? { ...i, isVisible: next } : i)));
      router.refresh();
    });
  };

  const handleEdit = (id: string) => {
    router.push(`/announcements/${id}`);
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      setOptimisticItems((prev) => prev.filter((i) => i.id !== id));
      await deleteAnnouncementAction(id);
      router.refresh();
    });
  };

  return (
    <AnnouncementList
      items={optimisticItems}
      onToggleVisible={handleToggle}
      onEdit={handleEdit}
      onDelete={handleDelete}
    />
  );
};

export default AnnouncementListContainer;
