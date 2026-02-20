'use client';

import { useEffect, useMemo, useState } from 'react';
import AssetComponent from '../../../../components/AssetComponent/AssetComponent';
import {
  createDefaultCoreAssetsDraft,
  CoreAssetDefinition,
  CoreAssetDraft,
  CoreAssetSpec,
  SPACE_BLASTER_CORE_ASSET_SPECS,
} from '../../../../lib/coreAssets';
import type { SpaceBlasterCoreAssetItem } from './page';
import styles from './CoreAssetsEditor.module.css';

type ApiPayload = {
  draft: CoreAssetDraft;
  specs: CoreAssetSpec[];
};

const GROUP_ORDER: Array<'Hero' | 'Enemies' | 'Ammo' | 'VFX' | 'SFX'> = [
  'Hero',
  'Enemies',
  'Ammo',
  'VFX',
  'SFX',
];

function mergeWithScaffold(args: {
  gameId: string;
  scaffoldItems: SpaceBlasterCoreAssetItem[];
  loadedDraft?: CoreAssetDraft | null;
  specs: CoreAssetSpec[];
}): CoreAssetDraft {
  const { gameId, scaffoldItems, loadedDraft, specs } = args;
  const fallback = createDefaultCoreAssetsDraft(gameId);
  const specById = new Map(specs.map((spec) => [spec.id, spec]));
  const fallbackById = new Map(
    fallback.definitions.map((definition) => [definition.id, definition]),
  );
  const loadedById = new Map(
    (loadedDraft?.definitions ?? []).map((definition) => [
      definition.id,
      definition,
    ]),
  );

  const definitions = scaffoldItems.map((item) => {
    const spec = specById.get(item.id);
    const base = fallbackById.get(item.id);
    const loaded = loadedById.get(item.id);

    if (!spec && loaded) {
      return {
        ...loaded,
        displayName: item.displayName,
      };
    }

    const slots = spec
      ? spec.slots.map((slot) => {
          const fromLoaded = loaded?.slots?.find(
            (entry) => entry.slotId === slot.slotId,
          );
          return {
            slotId: slot.slotId,
            label: slot.label,
            media: slot.media,
            file: fromLoaded?.file,
          };
        })
      : (loaded?.slots ?? base?.slots ?? []);

    const variables = Object.fromEntries(
      (spec?.variables ?? []).map((variable) => [
        variable.key,
        loaded?.variables?.[variable.key] ??
          base?.variables?.[variable.key] ??
          variable.defaultValue,
      ]),
    );

    const fx = Object.fromEntries(
      (spec?.fx ?? []).map((fxSpec) => [
        fxSpec.key,
        (loaded?.fx?.[fxSpec.key] ?? base?.fx?.[fxSpec.key] ?? '') as string,
      ]),
    );

    return {
      id: item.id,
      displayName: item.displayName,
      kind: item.kind,
      slots,
      variables,
      fx,
    };
  });

  return {
    gameId,
    schemaVersion: 'core-assets.v1',
    defaultTextureKey:
      loadedDraft?.defaultTextureKey ?? fallback.defaultTextureKey,
    definitions,
    updatedAt: loadedDraft?.updatedAt ?? fallback.updatedAt,
  };
}

export default function CoreAssetsEditor({
  gameId,
  scaffoldItems,
}: {
  gameId: string;
  scaffoldItems: SpaceBlasterCoreAssetItem[];
}) {
  const [specs, setSpecs] = useState<CoreAssetSpec[]>(
    SPACE_BLASTER_CORE_ASSET_SPECS,
  );
  const [draft, setDraft] = useState<CoreAssetDraft>(
    mergeWithScaffold({
      gameId,
      scaffoldItems,
      loadedDraft: null,
      specs: SPACE_BLASTER_CORE_ASSET_SPECS,
    }),
  );
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [uploadingById, setUploadingById] = useState<Record<string, string>>(
    {},
  );
  const [issues, setIssues] = useState<
    Array<{ path: string; message: string }>
  >([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/games/${gameId}/assets`, {
          cache: 'no-store',
        });
        if (!res.ok) throw new Error('Failed to load core assets');
        const json = (await res.json()) as ApiPayload;
        if (!cancelled) {
          const nextSpecs = json.specs?.length
            ? json.specs
            : SPACE_BLASTER_CORE_ASSET_SPECS;
          setSpecs(nextSpecs);
          setDraft(
            mergeWithScaffold({
              gameId,
              scaffoldItems,
              loadedDraft: json.draft,
              specs: nextSpecs,
            }),
          );
        }
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [gameId, scaffoldItems]);

  const specsById = useMemo(
    () => new Map(specs.map((spec) => [spec.id, spec])),
    [specs],
  );

  const fxOptions = useMemo(() => {
    return draft.definitions.map((definition) => ({
      id: definition.id,
      displayName: definition.displayName,
      kind: definition.kind,
    }));
  }, [draft]);

  const grouped = useMemo(() => {
    const byGroup = new Map<
      string,
      Array<{ definition: CoreAssetDefinition; spec: CoreAssetSpec }>
    >();

    draft.definitions.forEach((definition) => {
      const spec = specsById.get(definition.id);
      if (!spec) return;
      const scaffold = scaffoldItems.find((item) => item.id === definition.id);
      const group = scaffold?.category ?? (spec.group as string);
      const bucket = byGroup.get(group) ?? [];
      bucket.push({ definition, spec });
      byGroup.set(group, bucket);
    });

    return GROUP_ORDER.map((group) => ({
      group,
      entries: byGroup.get(group) ?? [],
    })).filter((g) => g.entries.length > 0);
  }, [draft, scaffoldItems, specsById]);

  const setDefinition = (next: CoreAssetDefinition) => {
    setDraft((current) => ({
      ...current,
      definitions: current.definitions.map((definition) =>
        definition.id === next.id ? next : definition,
      ),
    }));
  };

  const uploadSlot = async (
    definitionId: string,
    slotId: string,
    media: 'image' | 'audio',
    file: File,
  ) => {
    setUploadingById((current) => ({ ...current, [definitionId]: slotId }));
    try {
      const form = new FormData();
      form.set('definitionId', definitionId);
      form.set('slotId', slotId);
      form.set('media', media);
      form.set('file', file);

      const res = await fetch(`/api/games/${gameId}/assets/upload`, {
        method: 'POST',
        body: form,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error ?? 'Upload failed');
      }

      const uploadedFile = json.file as {
        objectKey?: string;
        inlineDataUrl?: string;
        fileName: string;
        contentType: string;
        uploadedAt: string;
      };

      setDraft((current) => ({
        ...current,
        definitions: current.definitions.map((definition) => {
          if (definition.id !== definitionId) return definition;
          return {
            ...definition,
            slots: definition.slots.map((slot) =>
              slot.slotId === slotId ? { ...slot, file: uploadedFile } : slot,
            ),
          };
        }),
      }));
    } finally {
      setUploadingById((current) => {
        const next = { ...current };
        delete next[definitionId];
        return next;
      });
    }
  };

  const onSave = async () => {
    setSaving(true);
    setError(null);
    setIssues([]);
    try {
      const res = await fetch(`/api/games/${gameId}/assets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          defaultTextureKey: draft.defaultTextureKey,
          definitions: draft.definitions,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (Array.isArray(json.issues)) {
          setIssues(json.issues);
        }
        throw new Error(json.error ?? 'Save failed');
      }
      const nextSpecs = json.specs?.length ? json.specs : specs;
      setSpecs(nextSpecs);
      setDraft(
        mergeWithScaffold({
          gameId,
          scaffoldItems,
          loadedDraft: json.draft,
          specs: nextSpecs,
        }),
      );
      setSavedAt(new Date().toLocaleTimeString());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.actions}>
        <button
          className={styles.saveButton}
          onClick={onSave}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Draft'}
        </button>
      </div>
      {error ? <div className={styles.error}>Error: {error}</div> : null}
      {savedAt ? (
        <div className={styles.success}>Saved at {savedAt}</div>
      ) : null}
      {loading ? (
        <div className={styles.state}>Refreshing assets...</div>
      ) : null}
      {issues.length > 0 ? (
        <ul className={styles.issueList}>
          {issues.map((issue, idx) => (
            <li key={`${issue.path}-${idx}`}>
              <strong>{issue.path}</strong>: {issue.message}
            </li>
          ))}
        </ul>
      ) : null}

      {grouped.map((group) => (
        <section key={group.group} className={styles.groupSection}>
          <h2 className={styles.groupTitle}>{group.group}</h2>
          <div className={styles.grid}>
            {group.entries.map(({ definition, spec }) => {
              const scaffold = scaffoldItems.find(
                (item) => item.id === definition.id,
              );
              const acceptedFileTypes = scaffold?.acceptedFileTypes ?? [];
              const displayName =
                scaffold?.displayName ?? definition.displayName;
              return (
                <AssetComponent
                  key={definition.id}
                  gameId={gameId}
                  assetId={definition.id}
                  displayName={displayName}
                  kind={definition.kind}
                  acceptedFileTypes={acceptedFileTypes}
                  definition={definition}
                  spec={spec}
                  fxOptions={fxOptions.filter(
                    (option) => option.id !== definition.id,
                  )}
                  uploadingSlotId={uploadingById[definition.id] ?? null}
                  onDefinitionChange={setDefinition}
                  onAssetUpdated={setDefinition}
                  onUploadSlot={(slotId, media, file) =>
                    uploadSlot(definition.id, slotId, media, file)
                  }
                />
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
