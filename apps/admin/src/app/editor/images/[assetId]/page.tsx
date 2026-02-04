import { AssetDetailClient } from './AssetDetailClient';

export default async function Page({ params }: { params: { assetId: string } }) {
  const { assetId } = await params;
  return <AssetDetailClient assetId={assetId} />;
}
