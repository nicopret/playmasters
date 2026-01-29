import { revalidatePath } from 'next/cache';
import Link from 'next/link';
import { listAnnouncements, setAnnouncementActive, deleteAnnouncement } from '../../../lib/announcements';
import styles from './page.module.css';

export default async function AnnouncementsPage() {
  const announcements = await listAnnouncements();

  async function toggleActive(formData: FormData) {
    'use server';
    const id = String(formData.get('id'));
    const active = formData.get('isActive') === 'on';
    await setAnnouncementActive(id, active);
    revalidatePath('/announcements');
  }

  async function deleteItem(formData: FormData) {
    'use server';
    const id = String(formData.get('id'));
    await deleteAnnouncement(id);
    revalidatePath('/announcements');
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Announcements</h1>
        <Link href="/announcements/new">New announcement</Link>
      </div>

      <table className={styles.table}>
        <thead>
          <tr>
            <th>Title</th>
            <th>Active</th>
            <th>Sort</th>
            <th>Updated</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {announcements.map((a) => (
            <tr key={a.id} className={styles.row}>
              <td>
                <div>{a.title}</div>
                <div className={styles.muted}>{a.body}</div>
              </td>
              <td>
                <form action={toggleActive} className={styles.status}>
                  <input type="hidden" name="id" value={a.id} />
                  <input type="checkbox" name="isActive" defaultChecked={a.isActive} />
                  <span className={styles.muted}>Active</span>
                </form>
              </td>
              <td>{a.sortOrder}</td>
              <td className={styles.muted}>{new Date(a.updatedAt).toLocaleString()}</td>
              <td>
                <div className={styles.actions}>
                  <Link href={`/announcements/${a.id}`}>Edit</Link>
                  <form action={deleteItem}>
                    <input type="hidden" name="id" value={a.id} />
                    <button type="submit">Delete</button>
                  </form>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
