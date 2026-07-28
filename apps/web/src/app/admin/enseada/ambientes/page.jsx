'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ImageUploader from '../../../../components/Enseada/ImageUploader';
import { ensureSession } from '../../../../lib/auth';
import { spaces as api } from '../../../../lib/enseada';
import admin from '../../../../styles/Admin.module.css';
import styles from '../../../../styles/Enseada.module.css';

const CATEGORIAS = [
  ['quarto', 'Quarto'],
  ['sala', 'Sala'],
  ['cozinha', 'Cozinha'],
  ['area-util', 'Área útil'],
  ['externa', 'Externa'],
];

const VAZIO = {
  slug: '',
  category: 'quarto',
  title: '',
  description: '',
  amenities: '',
  images: [],
};

function slugify(value) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function AmbientesPage() {
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);

  async function load() {
    setItems(await api.list());
    setStatus('ready');
  }

  useEffect(() => {
    (async () => {
      if (!(await ensureSession())) {
        router.replace('/admin/login');
        return;
      }
      try {
        await load();
      } catch {
        setStatus('error');
      }
    })();
  }, [router]);

  function startNew() {
    setError(null);
    setEditing({ ...VAZIO });
  }

  function startEdit(item) {
    setError(null);
    setEditing({
      id: item.id,
      slug: item.slug,
      category: item.category,
      title: item.title,
      description: item.description ?? '',
      amenities: (item.amenities ?? '')
        .split(',')
        .filter(Boolean)
        .join(', '),
      images: item.images ?? [],
    });
  }

  async function save(event) {
    event.preventDefault();
    setError(null);

    const payload = {
      slug: editing.slug || slugify(editing.title),
      category: editing.category,
      title: editing.title,
      description: editing.description,
      amenities: editing.amenities
        .split(',')
        .map((a) => a.trim())
        .filter(Boolean),
      images: editing.images.map((i) => ({
        url: i.url,
        alt: i.alt ?? '',
        width: i.width,
        height: i.height,
        blurDataURL: i.blurDataURL ?? '',
        cloudinaryId: i.cloudinaryId ?? undefined,
      })),
    };

    try {
      if (editing.id) await api.update(editing.id, payload);
      else await api.create(payload);
      setEditing(null);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(item) {
    if (!window.confirm(`Excluir "${item.title}"? As fotos também serão apagadas.`)) {
      return;
    }
    await api.remove(item.id);
    await load();
  }

  async function moveItem(index, direction) {
    const next = [...items];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
    await api.reorder(next.map((i) => i.id));
  }

  if (status === 'loading') return <p className={admin.state}>Carregando…</p>;
  if (status === 'error')
    return <p className={admin.state}>Não foi possível carregar os ambientes.</p>;

  return (
    <div className={admin.page}>
      <div className={admin.topbar}>
        <div>
          <h1 className={admin.title}>Ambientes</h1>
          <p className={admin.subtitle}>
            {items.length} {items.length === 1 ? 'ambiente' : 'ambientes'} · a ordem
            aqui é a ordem no site
          </p>
        </div>
        <div className={admin.actions}>
          {!editing ? (
            <button
              type="button"
              className={`${admin.button} ${admin.primary}`}
              onClick={startNew}
            >
              Novo ambiente
            </button>
          ) : null}
          <a className={admin.link} href="/admin/enseada">
            ← Voltar
          </a>
        </div>
      </div>

      {editing ? (
        <form className={styles.form} onSubmit={save}>
          <div className={styles.fieldset}>
            <p className={styles.legend}>
              {editing.id ? 'Editar ambiente' : 'Novo ambiente'}
            </p>

            <div className={styles.grid2}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="title">
                  Título
                </label>
                <input
                  id="title"
                  className={admin.input}
                  value={editing.title}
                  onChange={(e) =>
                    setEditing((p) => ({
                      ...p,
                      title: e.target.value,
                      slug: p.id ? p.slug : slugify(e.target.value),
                    }))
                  }
                  required
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="category">
                  Categoria
                </label>
                <select
                  id="category"
                  className={admin.input}
                  value={editing.category}
                  onChange={(e) =>
                    setEditing((p) => ({ ...p, category: e.target.value }))
                  }
                >
                  {CATEGORIAS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="slug">
                Slug
              </label>
              <input
                id="slug"
                className={admin.input}
                value={editing.slug}
                onChange={(e) => setEditing((p) => ({ ...p, slug: e.target.value }))}
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                required
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="description">
                Descrição
              </label>
              <textarea
                id="description"
                className={admin.textarea}
                style={{ minHeight: '7rem' }}
                value={editing.description}
                onChange={(e) =>
                  setEditing((p) => ({ ...p, description: e.target.value }))
                }
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="amenities">
                Comodidades (separadas por vírgula)
              </label>
              <input
                id="amenities"
                className={admin.input}
                value={editing.amenities}
                onChange={(e) =>
                  setEditing((p) => ({ ...p, amenities: e.target.value }))
                }
                placeholder="ar-condicionado, cama-queen"
              />
            </div>
          </div>

          <div className={styles.fieldset}>
            <p className={styles.legend}>Fotos</p>
            <span className={styles.hint}>
              A primeira foto do primeiro ambiente vira a capa do site. Ambiente
              sem foto não pode ser salvo.
            </span>
            <ImageUploader
              images={editing.images}
              folder={editing.slug || 'ambientes'}
              onChange={(images) => setEditing((p) => ({ ...p, images }))}
            />
          </div>

          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}

          <div className={admin.actions}>
            <button type="submit" className={`${admin.button} ${admin.primary}`}>
              Salvar
            </button>
            <button
              type="button"
              className={`${admin.button} ${admin.secondary}`}
              onClick={() => setEditing(null)}
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <div className={styles.items}>
          {items.length === 0 ? (
            <p className={admin.state}>
              Nenhum ambiente ainda. Comece pelo quarto principal.
            </p>
          ) : (
            items.map((item, index) => (
              <div className={styles.item} key={item.id}>
                <div className={styles.itemHead}>
                  <div>
                    <div className={styles.itemTitle}>{item.title}</div>
                    <div className={styles.itemMeta}>
                      {item.category} · /{item.slug} · {item.images?.length ?? 0}{' '}
                      {item.images?.length === 1 ? 'foto' : 'fotos'}
                    </div>
                  </div>
                  <div className={styles.itemActions}>
                    <button
                      type="button"
                      className={admin.smallButton}
                      onClick={() => moveItem(index, -1)}
                      disabled={index === 0}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className={admin.smallButton}
                      onClick={() => moveItem(index, 1)}
                      disabled={index === items.length - 1}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className={admin.smallButton}
                      onClick={() => startEdit(item)}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className={`${admin.smallButton} ${admin.smallDanger}`}
                      onClick={() => remove(item)}
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
