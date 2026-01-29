import { notFound, redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import Link from 'next/link';
import {
  deleteAnnouncement,
  getAnnouncement,
  updateAnnouncement,
} from '../../../../lib/announcements';
import styles from '../new/page.module.css';

type Props = {
  params: { id: string };
};

export default async function EditAnnouncementPage({ params }: Props) {
  const announcement = await getAnnouncement(params.id);
  if (!announcement) return notFound();

  async function save(formData: FormData) {
    'use server';
    const input = {
      title: String(formData.get('title') || '').trim(),
      body: String(formData.get('body') || '').trim(),
      imageUrl: (formData.get('imageUrl') as string) || undefined,
      ctaLabel: (formData.get('ctaLabel') as string) || undefined,
      ctaHref: (formData.get('ctaHref') as string) || undefined,
      sortOrder: Number(formData.get('sortOrder') || 0),
      isActive: formData.get('isActive') === 'on',
    };

    await updateAnnouncement(params.id, input);
    revalidatePath('/announcements');
    redirect('/announcements');
  }

  async function remove() {
    'use server';
    await deleteAnnouncement(params.id);
    revalidatePath('/announcements');
    redirect('/announcements');
  }

  return (
    <div className={styles.page}>
      <h1>Edit announcement</h1>
      <form className={styles.form} action={save}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="title">
            Title
          </label>
          <input className={styles.input} id="title" name="title" defaultValue={announcement.title} required />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="body">
            Body
          </label>
          <textarea
            className={styles.textarea}
            id="body"
            name="body"
            required
            rows={4}
            defaultValue={announcement.body}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="imageUrl">
            Image URL
          </label>
          <input
            className={styles.input}
            id="imageUrl"
            name="imageUrl"
            defaultValue={announcement.imageUrl}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="ctaLabel">
            CTA label
          </label>
          <input
            className={styles.input}
            id="ctaLabel"
            name="ctaLabel"
            defaultValue={announcement.ctaLabel}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="ctaHref">
            CTA href
          </label>
          <input
            className={styles.input}
            id="ctaHref"
            name="ctaHref"
            defaultValue={announcement.ctaHref}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="sortOrder">
            Sort order
          </label>
          <input
            className={styles.number}
            id="sortOrder"
            name="sortOrder"
            type="number"
            defaultValue={announcement.sortOrder}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="isActive">
            Active
          </label>
          <input
            className={styles.checkbox}
            id="isActive"
            name="isActive"
            type="checkbox"
            defaultChecked={announcement.isActive}
          />
        </div>

        <div className={styles.actions}>
          <button type="submit">Save</button>
          <Link href="/announcements">Cancel</Link>
        </div>
      </form>
      <form action={remove} className={styles.actions}>
        <button type="submit">Delete</button>
      </form>
    </div>
  );
}
