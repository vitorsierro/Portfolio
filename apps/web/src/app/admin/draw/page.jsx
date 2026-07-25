'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ensureSession } from '../../../lib/auth';
import { TOOLS } from '../../../lib/tools';
import styles from '../../../styles/ToolFrame.module.css';

const DRAW = TOOLS.find((tool) => tool.key === 'draw');

// O Excalidraw não define X-Frame-Options, então pode ser embutido — e assim
// o header do admin fica visível junto da ferramenta.
//
// O OpenClaw NÃO tem página equivalente: ele manda `X-Frame-Options: DENY` e
// `frame-ancestors 'none'` de propósito, como proteção anti-clickjacking numa
// ferramenta que executa comandos. Remover isso no proxy seria desligar uma
// defesa real, então lá o link abre em aba própria.
export default function DrawPage() {
  const router = useRouter();
  const [status, setStatus] = useState('checking'); // checking | ready | offline

  useEffect(() => {
    (async () => {
      const authed = await ensureSession();
      if (!authed) {
        router.replace('/admin/login');
        return;
      }

      // Um iframe apontando para um servidor fora do ar fica em branco, sem
      // erro nenhum — o que é indistinguível de "quebrou". Este ping resolve
      // isso: com no-cors a resposta é opaca (um 401 do gate ainda resolve),
      // mas um servidor inalcançável rejeita, que é o caso que importa aqui.
      try {
        await fetch(DRAW.url, { mode: 'no-cors', cache: 'no-store' });
        setStatus('ready');
      } catch {
        setStatus('offline');
      }
    })();
  }, [router]);

  if (status === 'checking') {
    return <p className={styles.state}>Carregando…</p>;
  }

  if (status === 'offline') {
    return (
      <div className={styles.state}>
        <p>
          Nao foi possivel alcancar o Excalidraw em <code>{DRAW.url}</code>.
        </p>
        <p className={styles.hint}>
          Suba as ferramentas com{' '}
          <code>docker compose -f infra/docker-compose.dev.yml up -d</code>. Se
          voce acabou de mudar <code>.env.local</code>, reinicie o{' '}
          <code>yarn dev</code> — a URL fica embutida no bundle.
        </p>
        <p>
          <a className={styles.link} href={DRAW.url} target="_blank" rel="noreferrer">
            Abrir em nova aba ↗
          </a>
        </p>
      </div>
    );
  }

  return (
    <iframe
      className={styles.frame}
      src={DRAW.url}
      title="Excalidraw"
      allow="clipboard-read; clipboard-write; fullscreen"
    />
  );
}
