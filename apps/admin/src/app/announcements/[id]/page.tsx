import Image from 'next/image';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import {
  deleteAnnouncement,
  getAnnouncement,
  updateAnnouncement,
} from '../../../../lib/announcements';
import dashStyles from '../../../components/AdminDashboard/AdminDashboard.module.css';
import styles from '../new/page.module.css';

type Props = {
  params: { id: string };
};

async function saveAnnouncement(id: string, formData: FormData) {
  'use server';
  const input = {
    title: String(formData.get('title') || '').trim(),
    body: String(formData.get('body') || '').trim(),
    imageUrl: (formData.get('imageUrl') as string) || null,
    ctaLabel: (formData.get('ctaLabel') as string) || null,
    ctaHref: (formData.get('ctaHref') as string) || null,
    sortOrder: Number(formData.get('sortOrder') || 0),
    isActive: formData.get('isActive') === 'on',
  };

  await updateAnnouncement(id, input);
  revalidatePath('/announcements');
  redirect('/announcements');
}

async function removeAnnouncement(id: string) {
  'use server';
  await deleteAnnouncement(id);
  revalidatePath('/announcements');
  redirect('/announcements');
}

export default async function EditAnnouncementPage({ params }: Props) {
  const { id } = await params;
  const announcement = await getAnnouncement(id);
  if (!announcement) return notFound();

  return (
    <div className={dashStyles.shell}>
      <aside className={dashStyles.sidebar}>
        <div className={dashStyles.logoWrap}>
          <Image
            src="/brand/playmaster_logo.png"
            alt="Playmasters logo"
            fill
            sizes="280px"
            className={dashStyles.logo}
            priority
          />
        </div>
        <nav className={dashStyles.menu}>
          {[
            { label: 'Home', href: '/' },
            { label: 'Announcements', href: '/announcements' },
            { label: 'Games', href: '/games' },
            { label: 'Assets', href: '/assets' },
          ].map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={`${dashStyles.menuItem} ${
                item.label === 'Announcements' ? dashStyles.menuActive : ''
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      <main className={dashStyles.main}>
        <header className={dashStyles.pageHeader}>
          <h1>Edit Announcement</h1>
        </header>

        <form className={styles.form} action={saveAnnouncement.bind(null, id)}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="title">
              Title
            </label>
            <input
              className={styles.input}
              id="title"
              name="title"
              defaultValue={announcement.title}
              required
            />
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
            <button className={styles.btn} type="submit">
              Save
            </button>
            <Link className={styles.btn} href="/announcements">
              Cancel
            </Link>
          </div>
        </form>

        <form action={removeAnnouncement.bind(null, id)} className={styles.actions}>
          <button className={styles.btn} type="submit">
            Delete
          </button>
        </form>
      </main>
    </div>
  );
}
