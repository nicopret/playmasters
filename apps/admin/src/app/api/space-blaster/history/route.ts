import { NextResponse } from 'next/server';
import { auth } from '../../../../auth';
import { QueryCommand, QueryCommandInput } from '@aws-sdk/lib-dynamodb';
import { ddbDocClient } from '../../../../../lib/ddb';
import { IMAGE_TABLE, PK_ATTR } from '../../../../../lib/imageAssets';

export const runtime = 'nodejs';

type HistoryEntry = {
  versionId: string;
  configHash?: string;
  publishedAt: string;
  publisher?: { id?: string; email?: string; name?: string };
  env: string;
  prevVersionId?: string | null;
};

type AuditItem = {
  action?: string;
  details?: { action?: string; configHash?: string };
  newVersion?: string;
  versionId?: string;
  timestamp?: string;
  actorUserId?: string;
  actorEmail?: string;
  prevVersion?: string | null;
};

const bad = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });

export async function GET(req: Request) {
  const session = await auth();
  if (process.env.NODE_ENV !== 'development' && !session?.user?.isAdmin)
    return bad('unauthorized', 401);

  const url = new URL(req.url);
  const env = url.searchParams.get('env') ?? 'dev';
  const limit = Math.min(
    Math.max(Number(url.searchParams.get('limit') ?? '20'), 1),
    100,
  );
  const cursor = url.searchParams.get('cursor') || undefined;

  const exprValues: Record<string, string> = { ':pk': `AUDIT#${env}` };
  const params: QueryCommandInput = {
    TableName: IMAGE_TABLE,
    KeyConditionExpression: '#pk = :pk',
    ExpressionAttributeNames: { '#pk': PK_ATTR },
    ExpressionAttributeValues: exprValues,
    ScanIndexForward: false,
    Limit: limit,
  };
  if (cursor) {
    params.ExclusiveStartKey = JSON.parse(
      Buffer.from(cursor, 'base64').toString('utf8'),
    );
  }

  const res = await ddbDocClient.send(new QueryCommand(params));
  const items =
    res.Items?.map((item) => {
      // strip partition key but keep remaining attributes
      const rest = { ...item };
      delete (rest as Record<string, unknown>)[PK_ATTR];
      return rest;
    }) ?? [];

  const history: HistoryEntry[] = items
    .filter(
      (i: AuditItem) =>
        i.action === 'PUBLISH_BUNDLE' || i.details?.action === 'rollback',
    )
    .map((i: AuditItem) => ({
      versionId: i.newVersion ?? i.details?.configHash ?? i.versionId ?? '',
      configHash: i.details?.configHash ?? i.newVersion ?? undefined,
      publishedAt: i.timestamp ?? '',
      publisher: { id: i.actorUserId, email: i.actorEmail },
      env,
      prevVersionId: i.prevVersion ?? null,
    }))
    .filter((h) => h.versionId);

  const nextCursor = res.LastEvaluatedKey
    ? Buffer.from(JSON.stringify(res.LastEvaluatedKey)).toString('base64')
    : undefined;

  return NextResponse.json({ items: history, nextCursor });
}
