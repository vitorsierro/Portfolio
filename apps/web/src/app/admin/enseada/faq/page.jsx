'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ensureSession } from '../../../../lib/auth';
import { faq as api } from '../../../../lib/enseada';
import admin from '../../../../styles/Admin.module.css';
import styles from '../../../../styles/Enseada.module.css';

const VAZIO = { question: '', answer: '' };

export default function FaqPage() {
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(VAZIO);
  const [editingId, setEditingId] = useState(null);
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

  async function save(event) {
    event.preventDefault();
    setError(null);
    try {
      if (editingId) await api.update(editingId, form);
      else await api.create(form);
      setForm(VAZIO);
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(item) {
    if (!window.confirm('Remover esta pergunta?')) return;
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
    return <p className={admin.state}>Não foi possível carregar o FAQ.</p>;

  return (
    <div className={admin.page}>
      <div className={admin.topbar}>
        <div>
          <h1 className={admin.title}>Perguntas frequentes</h1>
          <p className={admin.subtitle}>
            {items.length} perguntas · viram FAQPage no Google
          </p>
        </div>
        <a className={admin.link} href="/admin/enseada">
          ← Voltar
        </a>
      </div>

      <form className={styles.fieldset} onSubmit={save}>
        <p className={styles.legend}>
          {editingId ? 'Editar pergunta' : 'Nova pergunta'}
        </p>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="question">
            Pergunta
          </label>
          <input
            id="question"
            className={admin.input}
            value={form.question}
            onChange={(e) => setForm((p) => ({ ...p, question: e.target.value }))}
            placeholder="Aceita pets?"
            required
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="answer">
            Resposta
          </label>
          <textarea
            id="answer"
            className={admin.textarea}
            style={{ minHeight: '6rem' }}
            value={form.answer}
            onChange={(e) => setForm((p) => ({ ...p, answer: e.target.value }))}
            required
          />
          <span className={styles.hint}>
            Responda de forma direta: o Google costuma exibir a primeira frase.
          </span>
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
                setForm(VAZIO);
                setEditingId(null);
              }}
            >
              Cancelar
            </button>
          ) : null}
        </div>
      </form>

      <div className={styles.items}>
        {items.map((item, index) => (
          <div className={styles.item} key={item.id}>
            <div className={styles.itemHead}>
              <div>
                <div className={styles.itemTitle}>{item.question}</div>
                <div className={styles.itemMeta}>{item.answer}</div>
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
                  onClick={() => {
                    setEditingId(item.id);
                    setForm({ question: item.question, answer: item.answer });
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
