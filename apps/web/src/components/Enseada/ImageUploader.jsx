'use client';

import { useRef, useState } from 'react';
import { uploadImage } from '../../lib/enseada';
import styles from '../../styles/Enseada.module.css';

/**
 * Sobe as imagens e devolve os metadados que o site precisa (largura, altura
 * e blurDataURL). Sem essas dimensões o next/image causa layout shift — por
 * isso o upload passa pelo servidor em vez de aceitar URL colada.
 */
export default function ImageUploader({ images, onChange, folder, multiple = true }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function onFiles(event) {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;

    setBusy(true);
    setError(null);
    try {
      // Sequencial de propósito: o Cloudinary free tier estrangula rajadas, e
      // subir 15 fotos em paralelo costuma render erro em parte delas.
      const uploaded = [];
      for (const file of files) {
        uploaded.push(await uploadImage(file, folder));
      }
      onChange(multiple ? [...images, ...uploaded] : uploaded.slice(0, 1));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  function remove(index) {
    onChange(images.filter((_, i) => i !== index));
  }

  function move(index, direction) {
    const next = [...images];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <div className={styles.uploader}>
      <div className={styles.uploadRow}>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          multiple={multiple}
          onChange={onFiles}
          disabled={busy}
          aria-label="Escolher imagens"
        />
        {busy ? <span className={styles.hint}>Enviando…</span> : null}
      </div>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      {images.length > 0 ? (
        <ul className={styles.thumbs}>
          {images.map((image, index) => (
            <li key={image.url + index} className={styles.thumb}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.url} alt={image.alt || ''} />
              <div className={styles.thumbActions}>
                {multiple ? (
                  <>
                    <button type="button" onClick={() => move(index, -1)} disabled={index === 0}>
                      ←
                    </button>
                    <button
                      type="button"
                      onClick={() => move(index, 1)}
                      disabled={index === images.length - 1}
                    >
                      →
                    </button>
                  </>
                ) : null}
                <button type="button" onClick={() => remove(index)} className={styles.danger}>
                  remover
                </button>
              </div>
              <input
                type="text"
                value={image.alt ?? ''}
                placeholder="Texto alternativo (acessibilidade e SEO)"
                onChange={(e) => {
                  const next = [...images];
                  next[index] = { ...image, alt: e.target.value };
                  onChange(next);
                }}
              />
              <span className={styles.dims}>
                {image.width}×{image.height}
                {image.blurDataURL ? ' · blur ok' : ' · sem blur'}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
