import { NextResponse } from 'next/server';
import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { ddbDocClient } from '../../../../../lib/ddb';

export const runtime = 'nodejs';

const FORMATION_TABLE =
  process.env.DDB_TABLE_FORMATION_LAYOUTS ?? 'PlaymastersFormationLayouts';
const PK_ATTR = process.env.DDB_PK_NAME_FORMATION_LAYOUTS || 'PK';
const SK_ATTR = process.env.DDB_SK_NAME_FORMATION_LAYOUTS || 'SK';

type LayoutRecord = {
  layoutId: string;
  rows: number;
  cols: number;
  spacingX?: number;
  spacingY?: number;
  state?: string;
};

const bad = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });

export async function GET() {
  try {
    const res = await ddbDocClient.send(
      new ScanCommand({
        TableName: FORMATION_TABLE,
        FilterExpression: 'begins_with(#pk, :prefix)',
        ExpressionAttributeNames: { '#pk': PK_ATTR },
        ExpressionAttributeValues: { ':prefix': 'LAYOUT#' },
      }),
    );

    const layouts: LayoutRecord[] = (res.Items ?? [])
      .map((i) => {
        const layoutId: string | undefined = i.layoutId ?? i[SK_ATTR];
        if (!layoutId) return null;
        return {
          layoutId,
          rows: Number(i.rows ?? i.rowCount ?? 0),
          cols: Number(i.cols ?? i.colCount ?? 0),
          spacingX: i.spacingX ?? i.slotSpacingX,
          spacingY: i.spacingY ?? i.slotSpacingY,
          state: i.state,
        } as LayoutRecord;
      })
      .filter((l): l is LayoutRecord => Boolean(l && l.layoutId))
      // published only if state present; otherwise include all
      .filter((l) => !l.state || l.state === 'Published');

    return NextResponse.json({ layouts });
  } catch (err) {
    console.error('formation_layouts_list_error', err);
    return bad('catalog_failed', 500);
  }
}
