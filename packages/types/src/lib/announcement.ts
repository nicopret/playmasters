export type Announcement = {
  id: string;
  title: string;
  body: string;
  imageUrl?: string;
  ctaLabel?: string;
  ctaHref?: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};
