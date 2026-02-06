'use client';

import React, { useRef, useState, DragEvent } from 'react';
import styles from './ImageUpload.module.css';

export type ImageUploadProps = {
  title: string;
  value?: string; // optional initial image URL
  name?: string;
  onChange?: (file?: File) => void;
};

const ImageUpload: React.FC<ImageUploadProps> = ({ title, value, name = 'imageFile', onChange }) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [preview, setPreview] = useState<string | undefined>(value);
  const [isActive, setIsActive] = useState(false);

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    onChange?.(file);
    if (inputRef.current) {
      const dt = new DataTransfer();
      dt.items.add(file);
      inputRef.current.files = dt.files;
    }
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsActive(false);
    handleFiles(e.dataTransfer.files);
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsActive(true);
  };

  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsActive(false);
  };

  return (
    <div className={styles.wrapper}>
      <span className={styles.label}>{title}</span>
      <div
        className={`${styles.dropzone} ${isActive ? styles.dropzoneActive : ''}`}
        onClick={() => inputRef.current?.click()}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
      >
        {preview ? (
          <img src={preview} alt={title} className={styles.preview} />
        ) : (
          <span className={styles.placeholder}>Click or drop an image</span>
        )}
        <input
          ref={inputRef}
          className={styles.hiddenInput}
          type="file"
          accept="image/*"
          name={name}
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>
    </div>
  );
};

export default ImageUpload;
