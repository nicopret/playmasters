'use client';

import {
  ChangeEvent,
  DragEvent,
  FormEvent,
  KeyboardEvent,
  useRef,
  useState,
} from 'react';
import UploadNameModal from './UploadNameModal';
import styles from './AssetCard.module.css';

export type PhysicsValues = {
  mass: number;
  thrust: number;
  rotationSpeed: number;
  damping: number;
};

export type LunarDriftAssetDraft = {
  id: string;
  name: string;
  imageUrl: string;
  fileName: string;
  physics: PhysicsValues;
};

type AssetCardProps = {
  slotLabel: string;
  asset: LunarDriftAssetDraft | null;
  onCreateAsset: (assetName: string, file: File) => void;
  onSavePhysics: (physics: PhysicsValues) => void;
  onEditImage: () => void;
  editImageDisabled?: boolean;
  fixedUploadName?: string;
};

const formatPhysicsValue = (value: number): string => {
  if (Number.isInteger(value)) {
    return value.toString();
  }
  return value.toFixed(2);
};

export default function AssetCard({
  slotLabel,
  asset,
  onCreateAsset,
  onSavePhysics,
  onEditImage,
  editImageDisabled = false,
  fixedUploadName,
}: AssetCardProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isEditingPhysics, setIsEditingPhysics] = useState(false);
  const [physicsDraft, setPhysicsDraft] = useState<PhysicsValues>({
    mass: asset?.physics.mass ?? 1,
    thrust: asset?.physics.thrust ?? 20,
    rotationSpeed: asset?.physics.rotationSpeed ?? 4,
    damping: asset?.physics.damping ?? 0.08,
  });

  const openPicker = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelection = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    if (fixedUploadName?.trim()) {
      onCreateAsset(fixedUploadName.trim(), file);
      return;
    }
    setPendingFile(file);
    setIsModalOpen(true);
  };

  const onDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    handleFileSelection(event.dataTransfer.files);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openPicker();
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setPendingFile(null);
  };

  const confirmAssetName = (assetName: string) => {
    if (!pendingFile) return;
    onCreateAsset(assetName, pendingFile);
    closeModal();
  };

  const startPhysicsEdit = () => {
    setPhysicsDraft(
      asset?.physics ?? {
        mass: 1,
        thrust: 20,
        rotationSpeed: 4,
        damping: 0.08,
      },
    );
    setIsEditingPhysics(true);
  };

  const cancelPhysicsEdit = () => {
    setIsEditingPhysics(false);
  };

  const savePhysics = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSavePhysics(physicsDraft);
    setIsEditingPhysics(false);
  };

  const updateNumberField =
    (field: keyof PhysicsValues) => (event: ChangeEvent<HTMLInputElement>) => {
      const parsed = Number(event.target.value);
      setPhysicsDraft((current) => ({
        ...current,
        [field]: Number.isFinite(parsed) ? parsed : 0,
      }));
    };

  return (
    <article className={styles.card}>
      <header className={styles.header}>
        <h3 className={styles.title}>
          {asset ? asset.name : 'Click or drag a file to upload'}
        </h3>
        <div className={styles.slotLabel}>{slotLabel}</div>
      </header>

      {!asset ? (
        <section
          className={`${styles.emptyPanel} ${isDragOver ? styles.emptyPanelActive : ''}`}
          onClick={openPicker}
          onKeyDown={handleKeyDown}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={onDrop}
          role="button"
          tabIndex={0}
        >
          <p className={styles.emptyText}>Click to upload an image.</p>
          <p className={styles.emptyText}>Or drag and drop image files here.</p>
          <input
            ref={fileInputRef}
            className={styles.hiddenInput}
            type="file"
            accept="image/*"
            onChange={(event) => handleFileSelection(event.target.files)}
          />
        </section>
      ) : (
        <section className={styles.body}>
          <div className={styles.imageColumn}>
            <div className={styles.previewWrap}>
              <img
                src={asset.imageUrl}
                alt={asset.name}
                className={styles.preview}
              />
            </div>
            <div className={styles.fileName}>{asset.fileName}</div>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={onEditImage}
              disabled={editImageDisabled}
              title={editImageDisabled ? 'Coming soon' : undefined}
            >
              Edit Image
            </button>
          </div>

          <div className={styles.physicsColumn}>
            <h4 className={styles.sectionHeading}>Physics Values</h4>
            {!isEditingPhysics ? (
              <>
                <ul className={styles.physicsList}>
                  <li>mass: {formatPhysicsValue(asset.physics.mass)}</li>
                  <li>thrust: {formatPhysicsValue(asset.physics.thrust)}</li>
                  <li>
                    rotationSpeed:{' '}
                    {formatPhysicsValue(asset.physics.rotationSpeed)}
                  </li>
                  <li>damping: {formatPhysicsValue(asset.physics.damping)}</li>
                </ul>
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={startPhysicsEdit}
                >
                  Edit Physics Values
                </button>
              </>
            ) : (
              <form className={styles.form} onSubmit={savePhysics}>
                <label className={styles.field}>
                  <span>mass</span>
                  <input
                    type="number"
                    step="0.01"
                    value={physicsDraft.mass}
                    onChange={updateNumberField('mass')}
                  />
                </label>
                <label className={styles.field}>
                  <span>thrust</span>
                  <input
                    type="number"
                    step="0.01"
                    value={physicsDraft.thrust}
                    onChange={updateNumberField('thrust')}
                  />
                </label>
                <label className={styles.field}>
                  <span>rotationSpeed</span>
                  <input
                    type="number"
                    step="0.01"
                    value={physicsDraft.rotationSpeed}
                    onChange={updateNumberField('rotationSpeed')}
                  />
                </label>
                <label className={styles.field}>
                  <span>damping</span>
                  <input
                    type="number"
                    step="0.01"
                    value={physicsDraft.damping}
                    onChange={updateNumberField('damping')}
                  />
                </label>
                <div className={styles.formActions}>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={cancelPhysicsEdit}
                  >
                    Cancel
                  </button>
                  <button type="submit" className={styles.primaryButton}>
                    Save
                  </button>
                </div>
              </form>
            )}
          </div>
        </section>
      )}

      {fixedUploadName ? null : (
        <UploadNameModal
          isOpen={isModalOpen}
          onCancel={closeModal}
          onConfirm={confirmAssetName}
        />
      )}
    </article>
  );
}
