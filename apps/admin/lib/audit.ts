import { randomUUID } from 'crypto';
import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { ddbDocClient } from './ddb';
import { IMAGE_TABLE, PK_ATTR, SK_ATTR } from './imageAssets';

export type AuditAction =
  | 'CREATE_ASSET'
  | 'UPLOAD_VERSION'
  | 'PUBLISH_VERSION'
  | 'ROLLBACK_PUBLISHED'
  | 'ARCHIVE_VERSION'
  | 'UPDATE_METADATA'
  | 'PUBLISH_BUNDLE';

export type AuditLog = {
  id: string;
  entityType: string;
  entityId: string;
  action: AuditAction;
  actorUserId?: string;
  actorEmail?: string;
  timestamp: string;
  env?: string;
  domain?: string;
  prevVersion?: string | null;
  newVersion?: string;
  status?: 'success' | 'failure';
  requestId?: string;
  details?: Record<string, any>;
};

const auditPk = (entityId: string) => `AUDIT#${entityId}`;
const auditSk = (ts: string, id: string) => `AUDIT#${ts}#${id}`;

export async function logAudit(
  entry: Omit<AuditLog, 'id' | 'timestamp'> & { timestamp?: string },
) {
  const ts = entry.timestamp ?? new Date().toISOString();
  const id = randomUUID();
  const item: AuditLog & { [key: string]: any } = {
    ...entry,
    id,
    timestamp: ts,
    [PK_ATTR]: auditPk(entry.entityId),
    [SK_ATTR]: auditSk(ts, id),
  };
  await ddbDocClient.send(
    new PutCommand({
      TableName: IMAGE_TABLE,
      Item: item,
    }),
  );
  return item;
}

export async function listAudit(
  entityId: string,
  limit = 10,
): Promise<AuditLog[]> {
  const res = await ddbDocClient.send(
    new QueryCommand({
      TableName: IMAGE_TABLE,
      KeyConditionExpression: '#pk = :pk',
      ExpressionAttributeNames: { '#pk': PK_ATTR },
      ExpressionAttributeValues: {
        ':pk': auditPk(entityId),
      },
      ScanIndexForward: false,
      Limit: limit,
    }),
  );
  const items = (res.Items ?? []) as { [key: string]: any }[];
  return items.map((i) => {
    const { [PK_ATTR]: _pk, [SK_ATTR]: _sk, ...rest } = i;
    return rest as AuditLog;
  });
}
