'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { login } from '../../../lib/auth';
import styles from '../../../styles/Admin.module.css';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(email, password);
      router.push('/admin');
    } catch (err) {
      setError(err.message || 'Nao foi possivel entrar.');
      setLoading(false);
    }
  }

  return (
    <div className={styles.authWrapper}>
      <div className={styles.card}>
        <div>
          <h1 className={styles.title}>Area do admin</h1>
          <p className={styles.subtitle}>Entre para gerenciar o blog.</p>
        </div>

        <form className={styles.form} onSubmit={onSubmit}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="email">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              className={styles.input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="password">
              Senha
            </label>
            <input
              id="password"
              type="password"
              className={styles.input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            className={`${styles.button} ${styles.primary}`}
            disabled={loading}
          >
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
