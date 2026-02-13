import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import type { Announcement } from '@playmasters/types';
import { ddbDocClient } from './ddb';

const TABLE = process.env.DDB_TABLE_ANNOUNCEMENTS || 'PlaymastersAnnouncements';
const PK_VALUE = 'ANNOUNCEMENTS';
const PK_ATTR = process.env.DDB_PK_NAME || 'PK';
const SK_ATTR = process.env.DDB_SK_NAME || 'SK';
const IMAGE_BASE =
  'https://playmasters-announcement-images.s3.eu-west-2.amazonaws.com';

const formatImageUrl = (value?: string) => {
  if (!value) return value;
  if (/^https?:\/\//i.test(value)) return value;
  return `${IMAGE_BASE}/${value.replace(/^\//, '')}`;
};

type AnnouncementRecord = {
  id?: string;
  title?: string;
  body?: string;
  imageUrl?: string;
  ctaLabel?: string;
  ctaHref?: string;
  isActive?: boolean;
  sortOrder?: number;
  createdAt?: string;
  updatedAt?: string;
};

const toAnnouncement = (
  item: AnnouncementRecord | undefined,
): Announcement | null => {
  if (!item) return null;
  if (
    !item.id ||
    !item.title ||
    !item.body ||
    !item.createdAt ||
    !item.updatedAt
  )
    return null;
  return {
    id: item.id,
    title: item.title,
    body: item.body,
    imageUrl: formatImageUrl(item.imageUrl) as Announcement['imageUrl'],
    ctaLabel: item.ctaLabel,
    ctaHref: item.ctaHref,
    isActive: Boolean(item.isActive),
    sortOrder: item.sortOrder ?? 0,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
};

export async function getActiveAnnouncements(max = 5): Promise<Announcement[]> {
  try {
    const res = await ddbDocClient.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: `${PK_ATTR} = :pk AND begins_with(${SK_ATTR}, :sk)`,
        ExpressionAttributeValues: {
          ':pk': PK_VALUE,
          ':sk': 'ANNOUNCEMENT#',
        },
      }),
    );

    const items = res.Items ?? [];
    return items
      .map((i) => toAnnouncement(i))
      .filter((a): a is Announcement => Boolean(a && a.isActive))
      .sort((a, b) => {
        if (b.sortOrder !== a.sortOrder) return b.sortOrder - a.sortOrder;
        return b.updatedAt.localeCompare(a.updatedAt);
      })
      .slice(0, max);
  } catch (err) {
    // Dynamo may be unreachable during local dev; fail soft with a compact message.
    if (process.env.NODE_ENV === 'development') {
      const message =
        err instanceof Error ? err.message : 'Unknown announcements error';
      console.debug(
        `Announcements fallback (Dynamo unavailable or schema mismatch): ${message}`,
      );
    }
    return [];
  }
}
