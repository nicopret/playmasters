import { NextResponse } from 'next/server';
import { auth } from '../../../../auth';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { ddbDocClient } from '../../../../../lib/ddb';
import { IMAGE_TABLE, PK_ATTR } from '../../../../../lib/imageAssets';

export const runtime = 'nodejs';

const bad = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });

export async function GET(req: Request) {
  const session = await auth();
  if (process.env.NODE_ENV !== 'development' && !session?.user?.isAdmin)
    return bad('unauthorized', 401);

  const url = new URL(req.url);
  const entityId = url.searchParams.get('entityId');
  const limit = Number(url.searchParams.get('limit') ?? '20');
  if (!entityId) return bad('entityId_required', 400);

  try {
    const res = await ddbDocClient.send(
      new QueryCommand({
        TableName: IMAGE_TABLE,
        KeyConditionExpression: '#pk = :pk',
        ExpressionAttributeNames: { '#pk': PK_ATTR },
        ExpressionAttributeValues: { ':pk': `AUDIT#${entityId}` },
        ScanIndexForward: false,
        Limit: Math.min(Math.max(limit, 1), 100),
      }),
    );
    const items =
      (res.Items ?? []).map((i) => {
        const clone = { ...i };
        delete clone[PK_ATTR];
        return clone;
      }) ?? [];
    return NextResponse.json({ items });
  } catch (err) {
    console.error('audit_logs_query_error', err);
    return bad('audit_query_failed', 500);
  }
}
