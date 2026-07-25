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
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const authed = await ensureSession();
      if (!authed) {
        router.replace('/admin/login');
        return;
      }
      setReady(true);
    })();
  }, [router]);

  if (!ready) {
    return <p className={styles.state}>Carregando…</p>;
  }

  return (
    <div className={styles.wrapper}>
      <iframe
        className={styles.frame}
        src={DRAW.url}
        title="Excalidraw"
        // clipboard-write: copiar/colar dentro do quadro
        allow="clipboard-read; clipboard-write; fullscreen"
      />
    </div>
  );
}
