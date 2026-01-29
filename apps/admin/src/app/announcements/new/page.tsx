import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import Link from 'next/link';
import { createAnnouncement } from '../../../../lib/announcements';
import styles from './page.module.css';

export default function NewAnnouncementPage() {
  async function create(formData: FormData) {
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

    await createAnnouncement(input);
    revalidatePath('/announcements');
    redirect('/announcements');
  }

  return (
    <div className={styles.page}>
      <h1>Create announcement</h1>
      <form className={styles.form} action={create}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="title">
            Title
          </label>
          <input className={styles.input} id="title" name="title" required />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="body">
            Body
          </label>
          <textarea className={styles.textarea} id="body" name="body" required rows={4} />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="imageUrl">
            Image URL
          </label>
          <input className={styles.input} id="imageUrl" name="imageUrl" />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="ctaLabel">
            CTA label
          </label>
          <input className={styles.input} id="ctaLabel" name="ctaLabel" />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="ctaHref">
            CTA href
          </label>
          <input className={styles.input} id="ctaHref" name="ctaHref" />
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
            defaultValue={0}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="isActive">
            Active
          </label>
          <input className={styles.checkbox} id="isActive" name="isActive" type="checkbox" />
        </div>

        <div className={styles.actions}>
          <button type="submit">Save</button>
          <Link href="/announcements">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
