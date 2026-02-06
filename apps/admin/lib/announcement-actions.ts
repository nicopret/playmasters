'use server';

import { revalidatePath } from 'next/cache';
import { deleteAnnouncement, setAnnouncementActive } from './announcements';

export async function toggleAnnouncementVisible(id: string, next: boolean) {
  await setAnnouncementActive(id, next);
  revalidatePath('/announcements');
}

export async function deleteAnnouncementAction(id: string) {
  await deleteAnnouncement(id);
  revalidatePath('/announcements');
}
