'use client';

import { useEffect, useState } from 'react';
import { amenities as api } from '../../../../lib/enseada';
import admin from '../../../../styles/Admin.module.css';
import styles from '../../../../styles/Enseada.module.css';

const GROUP = ['essencial', 'cozinha', 'lazer', 'seguranca', 'externa'];
const EMPTY = { slug: '', label: '', icon: '', group: 'essencial' };

function slugify(value) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function AmenidadesPage() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);

  async function load() {
    setItems(await api.list());
    setStatus('ready');
  }

  useEffect(() => {
    (async () => {
      try {
        await load();
      } catch {
        setStatus('error');
      }
    })();
  }, []);

  async function save(event) {
    event.preventDefault();
    setError(null);
    const payload = { ...form, slug: form.slug || slugify(form.label) };
    try {
      if (editingId) await api.update(editingId, payload);
      else await api.create(payload);
      setForm(EMPTY);
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(item) {
    if (!window.confirm(`Remover "${item.label}"?`)) return;
    await api.remove(item.id);
    await load();
  }

  if (status === 'loading') return <p className={admin.state}>Carregando…</p>;
  if (status === 'error')
    return <p className={admin.state}>Não foi possível carregar as amenidades.</p>;

  return (
    <div className={admin.page}>
      <div className={admin.topbar}>
        <div>
          <h1 className={admin.title}>Amenidades</h1>
          <p className={admin.subtitle}>
            {items.length} itens · aparecem agrupados no site
          </p>
        </div>
        <a className={admin.link} href="/admin/enseada">
          ← Voltar
        </a>
      </div>

      <form className={styles.fieldset} onSubmit={save}>
        <p className={styles.legend}>
          {editingId ? 'Editar amenidade' : 'Nova amenidade'}
        </p>
        <div className={styles.grid2}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="label">
              Nome
            </label>
            <input
              id="label"
              className={admin.input}
              value={form.label}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  label: e.target.value,
                  slug: editingId ? p.slug : slugify(e.target.value),
                }))
              }
              placeholder="Wi-Fi 300MB"
              required
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="slug">
              Slug
            </label>
            <input
              id="slug"
              className={admin.input}
              value={form.slug}
              onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))}
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              required
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="group">
              Grupo
            </label>
            <select
              id="group"
              className={admin.input}
              value={form.group}
              onChange={(e) => setForm((p) => ({ ...p, group: e.target.value }))}
            >
              {GROUP.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="icon">
              Ícone (opcional)
            </label>
            <input
              id="icon"
              className={admin.input}
              value={form.icon}
              onChange={(e) => setForm((p) => ({ ...p, icon: e.target.value }))}
              placeholder="wifi"
            />
          </div>
        </div>

        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}

        <div className={admin.actions}>
          <button type="submit" className={`${admin.button} ${admin.primary}`}>
            {editingId ? 'Salvar' : 'Adicionar'}
          </button>
          {editingId ? (
            <button
              type="button"
              className={`${admin.button} ${admin.secondary}`}
              onClick={() => {
                setForm(EMPTY);
                setEditingId(null);
              }}
            >
              Cancelar
            </button>
          ) : null}
        </div>
      </form>

      <div className={styles.items}>
        {items.map((item) => (
          <div className={styles.item} key={item.id}>
            <div className={styles.itemHead}>
              <div>
                <div className={styles.itemTitle}>{item.label}</div>
                <div className={styles.itemMeta}>
                  {item.group} · {item.slug}
                  {item.icon ? ` · ${item.icon}` : ''}
                </div>
              </div>
              <div className={styles.itemActions}>
                <button
                  type="button"
                  className={admin.smallButton}
                  onClick={() => {
                    setEditingId(item.id);
                    setForm({
                      slug: item.slug,
                      label: item.label,
                      icon: item.icon ?? '',
                      group: item.group ?? 'essencial',
                    });
                  }}
                >
                  Editar
                </button>
                <button
                  type="button"
                  className={`${admin.smallButton} ${admin.smallDanger}`}
                  onClick={() => remove(item)}
                >
                  Remover
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
