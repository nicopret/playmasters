'use client';

import {
  DragEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import styles from './AssetComponent.module.css';

type AssetComponentProps = {
  onChange?: (file?: File) => void;
  inputName?: string;
};

export default function AssetComponent({
  onChange,
  inputName = 'assetFile',
}: AssetComponentProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | undefined>(undefined);
  const [isDragActive, setIsDragActive] = useState(false);

  const previewUrl = useMemo(() => {
    if (!file) return undefined;
    if (!file.type.startsWith('image/')) return undefined;
    return URL.createObjectURL(file);
  }, [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFiles = (files: FileList | null) => {
    const nextFile = files?.[0];
    if (!nextFile) return;
    setFile(nextFile);
    onChange?.(nextFile);
    if (inputRef.current) {
      const transfer = new DataTransfer();
      transfer.items.add(nextFile);
      inputRef.current.files = transfer.files;
    }
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragActive(false);
    handleFiles(event.dataTransfer.files);
  };

  const onDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragActive(true);
  };

  const onDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragActive(false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      inputRef.current?.click();
    }
  };

  return (
    <div
      className={`${styles.root} ${isDragActive ? styles.dragActive : ''}`}
      role="button"
      tabIndex={0}
      onKeyDown={onKeyDown}
      onClick={() => inputRef.current?.click()}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
    >
      {!file ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyText}>
            Click to upload an asset file, or drag and drop it here.
          </p>
        </div>
      ) : (
        <div className={styles.assetLayout}>
          <div className={styles.assetName}>{file.name}</div>

          <div className={styles.assetImage}>
            {previewUrl ? (
              <img src={previewUrl} alt={file.name} className={styles.image} />
            ) : (
              <span>Asset Image</span>
            )}
          </div>

          <div className={styles.assetVars}>Asset Variables</div>

          <div className={styles.assetFx}>Asset FX</div>
        </div>
      )}

      <input
        ref={inputRef}
        className={styles.hiddenInput}
        type="file"
        accept="image/*"
        name={inputName}
        onChange={(event) => handleFiles(event.target.files)}
      />
    </div>
  );
}
