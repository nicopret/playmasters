import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'crypto';
import type { Announcement } from '@playmasters/types';
import { ddbDocClient } from './ddb';

const TABLE = process.env.DDB_TABLE_ANNOUNCEMENTS || 'PlaymastersAnnouncements';
const MAX_ACTIVE = 5;
const PK_VALUE = 'ANNOUNCEMENTS';
const PK_ATTR = process.env.DDB_PK_NAME || 'PK';
const SK_ATTR = process.env.DDB_SK_NAME || 'SK';

type AnnouncementInput = {
  title: string;
  body: string;
  imageUrl?: string | null;
  ctaLabel?: string | null;
  ctaHref?: string | null;
  isActive: boolean;
  sortOrder: number;
};

const now = () => new Date().toISOString();

const toAnnouncement = (item: Record<string, any> | undefined): Announcement | null => {
  if (!item) return null;
  return {
    id: item.id,
    title: item.title,
    body: item.body,
    imageUrl: item.imageUrl,
    ctaLabel: item.ctaLabel,
    ctaHref: item.ctaHref,
    isActive: item.isActive,
    sortOrder: item.sortOrder ?? 0,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
};

export async function listAnnouncements(): Promise<Announcement[]> {
  try {
    const res = await ddbDocClient.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: `${PK_ATTR} = :pk AND begins_with(${SK_ATTR}, :sk)`,
        ExpressionAttributeValues: {
          ':pk': PK_VALUE,
          ':sk': 'ANNOUNCEMENT#',
        },
      })
    );
    const items = res.Items ?? [];
    return items
      .map((i) => toAnnouncement(i))
      .filter((a): a is Announcement => Boolean(a))
      .sort((a, b) => {
        if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
        if (b.sortOrder !== a.sortOrder) return b.sortOrder - a.sortOrder;
        return b.updatedAt.localeCompare(a.updatedAt);
      });
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.debug('Announcements list fallback (Dynamo unavailable or schema mismatch)');
    }
    return [];
  }
}

export async function getAnnouncement(id: string): Promise<Announcement | null> {
  const res = await ddbDocClient.send(
    new GetCommand({
      TableName: TABLE,
      Key: { [PK_ATTR]: PK_VALUE, [SK_ATTR]: `ANNOUNCEMENT#${id}` },
    })
  );
  return toAnnouncement(res.Item);
}

export async function createAnnouncement(input: AnnouncementInput): Promise<Announcement> {
  const id = randomUUID();
  const timestamp = now();
  const item: Announcement = {
    id,
    ...input,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await ddbDocClient.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        [PK_ATTR]: PK_VALUE,
        [SK_ATTR]: `ANNOUNCEMENT#${id}`,
        ...item,
      },
    })
  );

  if (item.isActive) {
    await enforceActiveLimit();
  }

  return item;
}

export async function updateAnnouncement(
  id: string,
  input: AnnouncementInput
): Promise<Announcement> {
  const timestamp = now();
  await ddbDocClient.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { [PK_ATTR]: PK_VALUE, [SK_ATTR]: `ANNOUNCEMENT#${id}` },
      UpdateExpression:
        'SET title = :title, body = :body, imageUrl = :imageUrl, ctaLabel = :ctaLabel, ctaHref = :ctaHref, isActive = :isActive, sortOrder = :sortOrder, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':title': input.title,
        ':body': input.body,
        ':imageUrl': input.imageUrl ?? null,
        ':ctaLabel': input.ctaLabel ?? null,
        ':ctaHref': input.ctaHref ?? null,
        ':isActive': input.isActive,
        ':sortOrder': input.sortOrder,
        ':updatedAt': timestamp,
      },
    })
  );

  if (input.isActive) {
    await enforceActiveLimit();
  }

  const updated = await getAnnouncement(id);
  if (!updated) throw new Error('Announcement not found after update');
  return updated;
}

export async function deleteAnnouncement(id: string): Promise<void> {
  await ddbDocClient.send(
    new DeleteCommand({
      TableName: TABLE,
      Key: { [PK_ATTR]: PK_VALUE, [SK_ATTR]: `ANNOUNCEMENT#${id}` },
    })
  );
}

export async function setAnnouncementActive(id: string, isActive: boolean): Promise<void> {
  await ddbDocClient.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { [PK_ATTR]: PK_VALUE, [SK_ATTR]: `ANNOUNCEMENT#${id}` },
      UpdateExpression: 'SET isActive = :isActive, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':isActive': isActive,
        ':updatedAt': now(),
      },
    })
  );

  if (isActive) {
    await enforceActiveLimit();
  }
}

export async function getActiveAnnouncements(max = MAX_ACTIVE): Promise<Announcement[]> {
  const all = await listAnnouncements();
  return all
    .filter((a) => a.isActive)
    .sort((a, b) => {
      if (b.sortOrder !== a.sortOrder) return b.sortOrder - a.sortOrder;
      return b.updatedAt.localeCompare(a.updatedAt);
    })
    .slice(0, max);
}

async function enforceActiveLimit() {
  const active = await getActiveAnnouncements(MAX_ACTIVE + 10);
  if (active.length <= MAX_ACTIVE) return;

  const overflow = active.slice(MAX_ACTIVE);
  for (const ann of overflow) {
    await ddbDocClient.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { [PK_ATTR]: PK_VALUE, [SK_ATTR]: `ANNOUNCEMENT#${ann.id}` },
        UpdateExpression: 'SET isActive = :inactive, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':inactive': false,
          ':updatedAt': now(),
        },
      })
    );
  }
}
