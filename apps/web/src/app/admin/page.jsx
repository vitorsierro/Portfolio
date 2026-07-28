'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ensureSession } from '../../lib/auth';
import { TOOLS } from '../../lib/tools';
import styles from '../../styles/Admin.module.css';

// O hub lista tudo que o admin pode abrir. Posts entra como mais um "destino",
// junto das ferramentas — o gerenciamento em si vive em /admin/posts.
const DESTINATIONS = [
  {
    key: 'posts',
    name: 'Posts',
    description: 'Criar, buscar, publicar e editar os posts do blog.',
    href: '/admin/posts',
    embedded: true,
  },
  {
    key: 'enseada',
    name: 'Enseada',
    description: 'Conteúdo do site de temporada: ambientes, guia e fotos.',
    href: '/admin/enseada',
    embedded: true,
  },
  ...TOOLS.map((tool) => ({
    key: tool.key,
    name: tool.name,
    description: tool.description,
    // O Excalidraw abre embutido (mantém o header); o OpenClaw proíbe iframe.
    href: tool.key === 'draw' ? '/admin/draw' : tool.url,
    embedded: tool.key === 'draw',
  })),
];

export default function AdminHub() {
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
    <div className={styles.page}>
      <div className={styles.topbar}>
        <div>
          <h1 className={styles.title}>Painel</h1>
          <p className={styles.subtitle}>
            Conteudo do blog e ferramentas self-hosted.
          </p>
        </div>
      </div>

      <div className={styles.toolGrid}>
        {DESTINATIONS.map((item) => (
          <a
            className={styles.toolCard}
            href={item.href}
            target={item.embedded ? undefined : '_blank'}
            rel={item.embedded ? undefined : 'noreferrer'}
            key={item.key}
          >
            <span className={styles.toolName}>{item.name}</span>
            <span className={styles.toolDescription}>{item.description}</span>
            <span className={styles.toolOpen}>
              {item.embedded ? 'Abrir →' : 'Abrir em nova aba ↗'}
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
