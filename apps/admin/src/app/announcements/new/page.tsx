import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { randomUUID } from 'crypto';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import InputField from '../../../../components/InputField/InputField';
import TextAreaField from '../../../../components/TextAreaField/TextAreaField';
import ImageUpload from '../../../../components/ImageUpload/ImageUpload';
import { createAnnouncement } from '../../../../lib/announcements';
import { s3Client } from '../../../../lib/s3';
import dashStyles from '../../../components/AdminDashboard/AdminDashboard.module.css';
import styles from './page.module.css';

const BUCKET = process.env.ANNOUNCEMENT_IMAGE_BUCKET || 'playmasters-announcement-images';

export default function NewAnnouncementPage() {
  async function create(formData: FormData) {
    'use server';
    let imageKey: string | undefined;
    const file = formData.get('imageFile');

    if (file && file instanceof File && file.size > 0) {
      const key = `announcements/${randomUUID()}-${file.name}`;
      const buffer = Buffer.from(await file.arrayBuffer());
      await s3Client.send(
        new PutObjectCommand({
          Bucket: BUCKET,
          Key: key,
          Body: buffer,
          ContentType: file.type || 'application/octet-stream',
        })
      );
      imageKey = key;
    }

    const input = {
      title: String(formData.get('title') || '').trim(),
      body: String(formData.get('body') || '').trim(),
      imageUrl: imageKey,
      ctaLabel: (formData.get('ctaLabel') as string) || undefined,
      ctaHref: (formData.get('ctaHref') as string) || undefined,
      sortOrder: Number(formData.get('sortOrder') || 0),
      isActive: true,
    };

    await createAnnouncement(input);
    revalidatePath('/announcements');
    redirect('/announcements');
  }

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
          <h1>Announcement Admin</h1>
        </header>

        <form className={styles.formShell} action={create}>
          <InputField title="Title" name="title" required />
          <TextAreaField title="Body" name="body" required />
          <ImageUpload title="Image" name="imageFile" />
          <InputField title="CTA Label" name="ctaLabel" />
          <InputField title="CTA href" name="ctaHref" />

          <div className={styles.actions}>
            <button type="submit" className={styles.btn}>
              Save
            </button>
            <Link href="/announcements" className={styles.btn}>
              Cancel
            </Link>
          </div>
        </form>
      </main>
    </div>
  );
}
