'use client';

import {
  DragEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  CoreAssetDefinition,
  CoreAssetFileRef,
  CoreAssetSpec,
  CoreAssetVariableValue,
} from '../../lib/coreAssets';
import styles from './AssetComponent.module.css';

type FxOption = {
  id: string;
  displayName: string;
  kind: CoreAssetDefinition['kind'];
};

type AssetComponentProps = {
  gameId: string;
  assetId: string;
  displayName: string;
  kind: CoreAssetDefinition['kind'];
  acceptedFileTypes: string[];
  definition: CoreAssetDefinition;
  spec: CoreAssetSpec;
  fxOptions: FxOption[];
  uploadingSlotId?: string | null;
  onDefinitionChange: (next: CoreAssetDefinition) => void;
  onAssetUpdated?: (next: CoreAssetDefinition) => void;
  onUploadSlot: (
    slotId: string,
    media: 'image' | 'audio',
    file: File,
  ) => Promise<void>;
};

const getFileUrl = (
  gameId: string,
  file: CoreAssetFileRef | undefined,
): string | undefined => {
  if (!file) return undefined;
  if (file.inlineDataUrl) return file.inlineDataUrl;
  if (file.objectKey) {
    return `/api/games/${gameId}/assets/file?key=${encodeURIComponent(file.objectKey)}`;
  }
  return undefined;
};

export default function AssetComponent({
  gameId,
  assetId,
  displayName,
  kind,
  acceptedFileTypes,
  definition,
  spec,
  fxOptions,
  uploadingSlotId,
  onDefinitionChange,
  onAssetUpdated,
  onUploadSlot,
}: AssetComponentProps) {
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [textDrafts, setTextDrafts] = useState<Record<string, string>>({});
  const firstSlot = spec.slots[0];
  const hasAnyAsset = definition.slots.some((slot) => !!slot.file);
  const unlockEditors = hasAnyAsset;

  const fxOptionsByKey = useMemo(() => {
    return Object.fromEntries(
      spec.fx.map((fxSpec) => [
        fxSpec.key,
        fxOptions.filter((option) => fxSpec.allowedKinds.includes(option.kind)),
      ]),
    ) as Record<string, FxOption[]>;
  }, [fxOptions, spec.fx]);

  useEffect(() => {
    const nextTextDrafts: Record<string, string> = {};
    spec.variables.forEach((variable) => {
      if (variable.type !== 'text') return;
      const raw = definition.variables[variable.key];
      nextTextDrafts[variable.key] = typeof raw === 'string' ? raw : '';
    });
    setTextDrafts(nextTextDrafts);
  }, [definition, spec.variables]);

  const setVariable = (key: string, value: CoreAssetVariableValue) => {
    const next = {
      ...definition,
      variables: {
        ...definition.variables,
        [key]: value,
      },
    };
    onDefinitionChange(next);
    onAssetUpdated?.(next);
  };

  const setFx = (key: string, value: string) => {
    const next = {
      ...definition,
      fx: {
        ...definition.fx,
        [key]: value,
      },
    };
    onDefinitionChange(next);
    onAssetUpdated?.(next);
  };

  const openSlotPicker = (slotId: string) => {
    inputRefs.current[slotId]?.click();
  };

  const validateType = (
    file: File,
    media: 'image' | 'audio',
  ): string | null => {
    if (acceptedFileTypes.length === 0) return null;
    const normalized = acceptedFileTypes.map((type) => type.toLowerCase());
    if (normalized.includes(file.type.toLowerCase())) return null;

    if (media === 'image') {
      return `Invalid file type '${file.type}'. Use: ${acceptedFileTypes.join(', ')}`;
    }
    if (media === 'audio') {
      return `Invalid file type '${file.type}'. Use: ${acceptedFileTypes.join(', ')}`;
    }
    return 'Unsupported file type.';
  };

  const handleFiles = async (
    slotId: string,
    media: 'image' | 'audio',
    files: FileList | null,
  ) => {
    const file = files?.[0];
    if (!file) return;
    const typeErr = validateType(file, media);
    if (typeErr) {
      setUploadError(typeErr);
      return;
    }
    setUploadError(null);
    try {
      await onUploadSlot(slotId, media, file);
    } catch (err) {
      setUploadError((err as Error).message || 'Upload failed');
    }
  };

  const onSlotDrop =
    (slotId: string, media: 'image' | 'audio') =>
    async (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      event.stopPropagation();
      await handleFiles(slotId, media, event.dataTransfer.files);
    };

  const onImageAreaDrop = async (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!firstSlot) return;
    await handleFiles(
      firstSlot.slotId,
      firstSlot.media,
      event.dataTransfer.files,
    );
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!firstSlot) return;
      openSlotPicker(firstSlot.slotId);
    }
  };

  return (
    <article className={styles.root} data-asset-id={assetId}>
      <div className={styles.layout}>
        <header className={styles.nameRow}>
          <h3 className={styles.heading}>{displayName}</h3>
          <div className={styles.assetMeta}>ID: {assetId}</div>
          <div className={styles.assetMeta}>Kind: {kind}</div>
        </header>

        <section
          className={styles.imageCol}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => void onImageAreaDrop(event)}
        >
          <h4 className={styles.panelTitle}>Asset Image</h4>
          <div className={styles.slotList}>
            {spec.slots.map((slot) => {
              const current = definition.slots.find(
                (entry) => entry.slotId === slot.slotId,
              );
              const url = getFileUrl(gameId, current?.file);
              const isUploading = uploadingSlotId === slot.slotId;
              return (
                <div
                  key={slot.slotId}
                  className={styles.slotCard}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) =>
                    void onSlotDrop(slot.slotId, slot.media)(event)
                  }
                  onClick={() => openSlotPicker(slot.slotId)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={onKeyDown}
                >
                  <div className={styles.slotHeader}>
                    <strong>{slot.label}</strong>
                    {isUploading ? <span>Uploading...</span> : null}
                  </div>
                  {slot.media === 'image' ? (
                    url ? (
                      <img
                        src={url}
                        alt={`${displayName} ${slot.label}`}
                        className={styles.previewImage}
                      />
                    ) : (
                      <span className={styles.placeholder}>
                        Drag and drop to upload (PNG), or click to browse.
                      </span>
                    )
                  ) : url ? (
                    <audio controls className={styles.audioPlayer} src={url} />
                  ) : (
                    <span className={styles.placeholder}>
                      Drag and drop to upload audio, or click to browse.
                    </span>
                  )}
                  {current?.file?.fileName ? (
                    <div className={styles.fileName}>
                      {current.file.fileName}
                    </div>
                  ) : null}
                  <input
                    ref={(node) => {
                      inputRefs.current[slot.slotId] = node;
                    }}
                    className={styles.hiddenInput}
                    type="file"
                    accept={
                      acceptedFileTypes.join(',') ||
                      (slot.media === 'image' ? 'image/*' : 'audio/*')
                    }
                    onChange={(event) =>
                      void handleFiles(
                        slot.slotId,
                        slot.media,
                        event.target.files,
                      )
                    }
                  />
                </div>
              );
            })}
          </div>
          {uploadError ? (
            <div className={styles.error}>{uploadError}</div>
          ) : null}
        </section>

        <section className={styles.variablesCol}>
          <h4 className={styles.panelTitle}>Asset Variables</h4>
          <fieldset className={styles.fieldset} disabled={!unlockEditors}>
            <div className={styles.variablesGrid}>
              {spec.variables.map((variable) => {
                const raw = definition.variables[variable.key];
                if (variable.type === 'boolean') {
                  return (
                    <label key={variable.key} className={styles.checkboxField}>
                      <input
                        type="checkbox"
                        checked={Boolean(raw)}
                        onChange={(event) =>
                          setVariable(variable.key, event.target.checked)
                        }
                      />
                      <span>{variable.label}</span>
                    </label>
                  );
                }
                if (variable.type === 'text') {
                  return (
                    <label key={variable.key} className={styles.variableField}>
                      <span>{variable.label}</span>
                      <textarea
                        className={styles.textInput}
                        value={textDrafts[variable.key] ?? ''}
                        onChange={(event) =>
                          setTextDrafts((current) => ({
                            ...current,
                            [variable.key]: event.target.value,
                          }))
                        }
                        onBlur={() => {
                          const nextValue = textDrafts[variable.key] ?? '';
                          const currentValue =
                            typeof raw === 'string' ? raw : '';
                          if (nextValue !== currentValue) {
                            setVariable(variable.key, nextValue);
                          }
                        }}
                        rows={5}
                      />
                    </label>
                  );
                }
                return (
                  <label key={variable.key} className={styles.variableField}>
                    <span>{variable.label}</span>
                    <input
                      className={styles.numberInput}
                      type="number"
                      min={variable.min}
                      max={variable.max}
                      step={variable.step ?? 1}
                      value={typeof raw === 'number' ? raw : 0}
                      onChange={(event) =>
                        setVariable(variable.key, Number(event.target.value))
                      }
                    />
                  </label>
                );
              })}
            </div>
          </fieldset>
          {!unlockEditors ? (
            <p className={styles.lockedHint}>
              Upload a file to enable variables.
            </p>
          ) : null}
        </section>

        <section className={styles.fxRow}>
          <h4 className={styles.panelTitle}>Asset FX</h4>
          {spec.fx.length === 0 ? (
            <p className={styles.fxEmpty}>No FX links for this core type.</p>
          ) : (
            <fieldset className={styles.fieldset} disabled={!unlockEditors}>
              <div className={styles.fxGrid}>
                {spec.fx.map((fxSpec) => (
                  <label key={fxSpec.key} className={styles.variableField}>
                    <span>{fxSpec.label}</span>
                    <select
                      className={styles.select}
                      value={definition.fx[fxSpec.key] ?? ''}
                      onChange={(event) =>
                        setFx(fxSpec.key, event.target.value)
                      }
                    >
                      <option value="">None</option>
                      {(fxOptionsByKey[fxSpec.key] ?? []).map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.displayName} ({option.id})
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          {!unlockEditors && spec.fx.length > 0 ? (
            <p className={styles.lockedHint}>
              Upload a file to enable FX links.
            </p>
          ) : null}
        </section>
      </div>
    </article>
  );
}
