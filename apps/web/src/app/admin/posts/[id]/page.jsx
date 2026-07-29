'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { authFetch, ensureSession } from '../../../../lib/auth';
import styles from '../../../../styles/Admin.module.css';
import { ROUTER_LOGIN } from '../../../../constants';

const EMPTY = {
  title: '',
  slug: '',
  body: '',
  coverImageUrl: '',
  tags: '',
  published: false,
};

function slugify(value) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function PostEditor() {
  const router = useRouter();
  const params = useParams();
  const id = params.id;
  const isNew = id === 'new';

  const [form, setForm] = useState(EMPTY);
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [status, setStatus] = useState(isNew ? 'ready' : 'loading');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const authed = await ensureSession();
      if (!authed) {
        router.replace(ROUTER_LOGIN);
        return;
      }
      if (isNew) {
        setStatus('ready');
        return;
      }
      const response = await authFetch(`/admin/posts/${id}`);
      if (response.status === 401) {
        router.replace(ROUTER_LOGIN);
        return;
      }
      if (!response.ok) {
        setStatus('error');
        return;
      }
      const data = await response.json();
      setForm({
        title: data.title,
        slug: data.slug,
        body: data.body,
        coverImageUrl: data.coverImageUrl || '',
        tags: (data.tags || []).join(', '),
        published: data.published,
      });
      setStatus('ready');
    })();
  }, [id, isNew, router]);

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function onTitleChange(value) {
    setForm((prev) => ({
      ...prev,
      title: value,
      slug: slugTouched ? prev.slug : slugify(value),
    }));
  }

  async function onSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      title: form.title.trim(),
      slug: (form.slug || slugify(form.title)).trim(),
      body: form.body,
      tags: form.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      published: form.published,
    };
    const cover = form.coverImageUrl.trim();
    if (cover) {
      payload.coverImageUrl = cover;
    }

    const response = await authFetch(isNew ? '/posts' : `/posts/${id}`, {
      method: isNew ? 'POST' : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (response.status === 401) {
      router.replace(ROUTER_LOGIN);
      return;
    }
    if (response.status === 409) {
      setError('Ja existe um post com esse slug.');
      setSaving(false);
      return;
    }
    if (!response.ok) {
      setError('Nao foi possivel salvar. Verifique os campos.');
      setSaving(false);
      return;
    }

    router.push('/admin');
  }

  if (status === 'loading') {
    return <p className={styles.state}>Carregando…</p>;
  }
  if (status === 'error') {
    return <p className={styles.state}>Nao foi possivel carregar o post.</p>;
  }

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <h1 className={styles.title}>{isNew ? 'Novo post' : 'Editar post'}</h1>
        <a className={styles.link} href="/admin">
          ← Voltar
        </a>
      </div>

      <form className={styles.form} onSubmit={onSubmit}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="title">
            Titulo
          </label>
          <input
            id="title"
            className={styles.input}
            value={form.title}
            onChange={(e) => onTitleChange(e.target.value)}
            required
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="slug">
            Slug
          </label>
          <input
            id="slug"
            className={styles.input}
            value={form.slug}
            onChange={(e) => {
              setSlugTouched(true);
              update('slug', e.target.value);
            }}
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            title="Somente letras minusculas, numeros e hifens"
            required
          />
          <span className={styles.hint}>URL: /blog/post/{form.slug || '...'}</span>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="cover">
            URL da imagem de capa (opcional)
          </label>
          <input
            id="cover"
            type="url"
            className={styles.input}
            value={form.coverImageUrl}
            onChange={(e) => update('coverImageUrl', e.target.value)}
            placeholder="https://..."
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="tags">
            Tags (separadas por virgula)
          </label>
          <input
            id="tags"
            className={styles.input}
            value={form.tags}
            onChange={(e) => update('tags', e.target.value)}
            placeholder="next, react, carreira"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="body">
            Conteudo (Markdown)
          </label>
          <textarea
            id="body"
            className={styles.textarea}
            value={form.body}
            onChange={(e) => update('body', e.target.value)}
            required
          />
        </div>

        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={form.published}
            onChange={(e) => update('published', e.target.checked)}
          />
          <span>Publicado (visivel no /blog)</span>
        </label>

        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}

        <div className={styles.actions}>
          <button
            type="submit"
            className={`${styles.button} ${styles.primary}`}
            disabled={saving}
          >
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
          <a className={`${styles.button} ${styles.secondary}`} href="/admin">
            Cancelar
          </a>
        </div>
      </form>
    </div>
  );
}
