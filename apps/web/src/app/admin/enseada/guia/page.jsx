'use client';

import { useCallback, useEffect, useState } from 'react';
import ImageUploader from '../../../../components/Enseada/ImageUploader';
import { activities, restaurants } from '../../../../lib/enseada';
import admin from '../../../../styles/Admin.module.css';
import styles from '../../../../styles/Enseada.module.css';

const CATEGORIAS = ['praia', 'trilha', 'cultura', 'familia', 'chuva'];
const ESTACOES = ['verao', 'outono', 'inverno', 'primavera'];

const EMPTY_RESTAURANT = {
  slug: '',
  name: '',
  cuisine: '',
  priceRange: '$$',
  distanceMinutes: 0,
  distanceMode: 'walking',
  description: '',
  tip: '',
  mapsUrl: '',
  images: [],
};

const EMPTY_ACTIVE = {
  slug: '',
  name: '',
  category: 'praia',
  seasons: [],
  distanceMinutes: 0,
  description: '',
  tip: '',
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

// A imagem única do guia é guardada em campos soltos na tabela; o uploader
// trabalha com lista, então convertemos nas duas pontas.
function toImageList(row) {
  return row.imageUrl
    ? [
        {
          url: row.imageUrl,
          alt: row.imageAlt ?? '',
          width: row.imageWidth ?? 0,
          height: row.imageHeight ?? 0,
          blurDataURL: row.imageBlur ?? '',
          cloudinaryId: row.cloudinaryId ?? undefined,
        },
      ]
    : [];
}

function fromImageList(images) {
  const image = images[0];
  return image
    ? {
        imageUrl: image.url,
        imageAlt: image.alt ?? '',
        imageWidth: image.width,
        imageHeight: image.height,
        imageBlur: image.blurDataURL ?? '',
        cloudinaryId: image.cloudinaryId ?? undefined,
      }
    : { imageUrl: '', imageAlt: '', imageBlur: '' };
}

export default function GuiaPage() {
  const [aba, setAba] = useState('restaurantes');
  const [lista, setLista] = useState([]);
  const [editing, setEditing] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);

  const api = aba === 'restaurantes' ? restaurants : activities;

  // `api` e restaurants ou activities — objetos de modulo, entao a referencia
  // e estavel por aba e serve de dependencia.
  const recarregar = useCallback(async () => {
    setLista(await api.list());
    setStatus('ready');
  }, [api]);

  // Carga inicial e troca de aba passam pelo mesmo caminho. Antes trocarAba()
  // buscava por conta propria e o efeito rodava com lista de dependencias
  // vazia, mentindo sobre `load` — o que so nao quebrava porque a aba nova era
  // passada na mao. Agora quem busca e o efeito, e ninguem precisa lembrar.
  useEffect(() => {
    setStatus('loading');
    recarregar().catch(() => setStatus('error'));
  }, [recarregar]);

  function trocarAba(nova) {
    setAba(nova);
    setEditing(null);
    setError(null);
  }

  function novo() {
    setError(null);
    setEditing(
      aba === 'restaurantes' ? { ...EMPTY_RESTAURANT } : { ...EMPTY_ACTIVE },
    );
  }

  function editar(item) {
    setError(null);
    const base = {
      id: item.id,
      slug: item.slug,
      name: item.name,
      distanceMinutes: item.distanceMinutes ?? 0,
      description: item.description ?? '',
      tip: item.tip ?? '',
      images: toImageList(item),
    };
    setEditing(
      aba === 'restaurantes'
        ? {
            ...base,
            cuisine: item.cuisine ?? '',
            priceRange: item.priceRange ?? '$$',
            distanceMode: item.distanceMode ?? 'walking',
            mapsUrl: item.mapsUrl ?? '',
          }
        : {
            ...base,
            category: item.category ?? 'praia',
            seasons: (item.seasons ?? '').split(',').filter(Boolean),
          },
    );
  }

  async function salvar(event) {
    event.preventDefault();
    setError(null);

    const { images, id, ...rest } = editing;
    const payload = {
      ...rest,
      slug: rest.slug || slugify(rest.name),
      distanceMinutes: Number(rest.distanceMinutes) || 0,
      ...fromImageList(images),
    };

    try {
      if (id) await api.update(id, payload);
      else await api.create(payload);
      setEditing(null);
      await recarregar();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remover(item) {
    if (!window.confirm(`Remover "${item.name}"?`)) return;
    await api.remove(item.id);
    await recarregar();
  }

  if (status === 'loading') return <p className={admin.state}>Carregando…</p>;
  if (status === 'error')
    return <p className={admin.state}>Não foi possível carregar o guia.</p>;

  const ehRestaurante = aba === 'restaurantes';

  return (
    <div className={admin.page}>
      <div className={admin.topbar}>
        <div>
          <h1 className={admin.title}>Guia local</h1>
          <p className={admin.subtitle}>
            É o conteúdo que traz tráfego orgânico — a dica pessoal é o que
            diferencia de uma lista qualquer.
          </p>
        </div>
        <a className={admin.link} href="/admin/enseada">
          ← Voltar
        </a>
      </div>

      <div className={admin.actions}>
        <button
          type="button"
          className={`${admin.button} ${ehRestaurante ? admin.primary : admin.secondary}`}
          onClick={() => trocarAba('restaurantes')}
        >
          Restaurantes
        </button>
        <button
          type="button"
          className={`${admin.button} ${!ehRestaurante ? admin.primary : admin.secondary}`}
          onClick={() => trocarAba('atividades')}
        >
          O que fazer
        </button>
        {!editing ? (
          <button
            type="button"
            className={`${admin.button} ${admin.secondary}`}
            onClick={novo}
          >
            + Adicionar
          </button>
        ) : null}
      </div>

      {editing ? (
        <form className={styles.form} onSubmit={salvar}>
          <div className={styles.fieldset}>
            <p className={styles.legend}>
              {editing.id ? 'Editar' : 'Novo'} {ehRestaurante ? 'restaurante' : 'programa'}
            </p>

            <div className={styles.grid2}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="name">
                  Nome
                </label>
                <input
                  id="name"
                  className={admin.input}
                  value={editing.name}
                  onChange={(e) =>
                    setEditing((p) => ({
                      ...p,
                      name: e.target.value,
                      slug: p.id ? p.slug : slugify(e.target.value),
                    }))
                  }
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
                  value={editing.slug}
                  onChange={(e) => setEditing((p) => ({ ...p, slug: e.target.value }))}
                  pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                  required
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="distanceMinutes">
                  Distância (min)
                </label>
                <input
                  id="distanceMinutes"
                  type="number"
                  min="0"
                  className={admin.input}
                  value={editing.distanceMinutes}
                  onChange={(e) =>
                    setEditing((p) => ({ ...p, distanceMinutes: e.target.value }))
                  }
                />
              </div>

              {ehRestaurante ? (
                <>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="cuisine">
                      Cozinha
                    </label>
                    <input
                      id="cuisine"
                      className={admin.input}
                      value={editing.cuisine}
                      onChange={(e) =>
                        setEditing((p) => ({ ...p, cuisine: e.target.value }))
                      }
                      placeholder="Italiana"
                    />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="priceRange">
                      Faixa de preço
                    </label>
                    <select
                      id="priceRange"
                      className={admin.input}
                      value={editing.priceRange}
                      onChange={(e) =>
                        setEditing((p) => ({ ...p, priceRange: e.target.value }))
                      }
                    >
                      {['$', '$$', '$$$', '$$$$'].map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="distanceMode">
                      Como chegar
                    </label>
                    <select
                      id="distanceMode"
                      className={admin.input}
                      value={editing.distanceMode}
                      onChange={(e) =>
                        setEditing((p) => ({ ...p, distanceMode: e.target.value }))
                      }
                    >
                      <option value="walking">a pé</option>
                      <option value="driving">de carro</option>
                    </select>
                  </div>
                </>
              ) : (
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
                    {CATEGORIAS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {!ehRestaurante ? (
              <div className={styles.field}>
                <span className={styles.label}>Estações</span>
                <div className={styles.itemActions}>
                  {ESTACOES.map((estacao) => (
                    <label key={estacao} className={styles.checkbox}>
                      <input
                        type="checkbox"
                        checked={editing.seasons.includes(estacao)}
                        onChange={(e) =>
                          setEditing((p) => ({
                            ...p,
                            seasons: e.target.checked
                              ? [...p.seasons, estacao]
                              : p.seasons.filter((s) => s !== estacao),
                          }))
                        }
                      />
                      <span>{estacao}</span>
                    </label>
                  ))}
                </div>
                <span className={styles.hint}>
                  Marcar inverno ajuda quem procura o que fazer na baixa temporada.
                </span>
              </div>
            ) : null}

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
              <label className={styles.label} htmlFor="tip">
                Sua dica pessoal
              </label>
              <textarea
                id="tip"
                className={admin.textarea}
                style={{ minHeight: '5rem' }}
                value={editing.tip}
                onChange={(e) => setEditing((p) => ({ ...p, tip: e.target.value }))}
                placeholder="Peça a burrata e reserve a mesa da varanda."
              />
              <span className={styles.hint}>
                É o que ninguém copia do Google. Escreva como falaria a um amigo.
              </span>
            </div>

            {ehRestaurante ? (
              <div className={styles.field}>
                <label className={styles.label} htmlFor="mapsUrl">
                  Link do Google Maps
                </label>
                <input
                  id="mapsUrl"
                  className={admin.input}
                  value={editing.mapsUrl}
                  onChange={(e) =>
                    setEditing((p) => ({ ...p, mapsUrl: e.target.value }))
                  }
                />
              </div>
            ) : null}
          </div>

          <div className={styles.fieldset}>
            <p className={styles.legend}>Foto</p>
            <ImageUploader
              images={editing.images}
              folder="guia"
              multiple={false}
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
          {lista.length === 0 ? (
            <p className={admin.state}>Nada cadastrado ainda.</p>
          ) : (
            lista.map((item) => (
              <div className={styles.item} key={item.id}>
                <div className={styles.itemHead}>
                  <div>
                    <div className={styles.itemTitle}>{item.name}</div>
                    <div className={styles.itemMeta}>
                      {ehRestaurante
                        ? `${item.cuisine || '—'} · ${item.priceRange} · ${item.distanceMinutes} min`
                        : `${item.category} · ${item.distanceMinutes} min${item.seasons ? ` · ${item.seasons}` : ''}`}
                      {item.tip ? ' · com dica' : ' · SEM DICA'}
                    </div>
                  </div>
                  <div className={styles.itemActions}>
                    <button
                      type="button"
                      className={admin.smallButton}
                      onClick={() => editar(item)}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className={`${admin.smallButton} ${admin.smallDanger}`}
                      onClick={() => remover(item)}
                    >
                      Remover
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
