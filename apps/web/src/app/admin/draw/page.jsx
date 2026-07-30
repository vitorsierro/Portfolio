'use client';

import { useEffect, useState } from 'react';
import { TOOLS } from '../../../lib/tools';
import styles from '../../../styles/ToolFrame.module.css';

const DRAW = TOOLS.find((tool) => tool.key === 'draw');

// O Excalidraw não define X-Frame-Options, então pode ser embutido — e assim
// o header do admin fica visível junto da ferramenta.
//
// O Hermes NÃO tem página equivalente: o comportamento dele quanto a
// `X-Frame-Options`/`frame-ancestors` não foi verificado, e afrouxar embed no
// proxy é o tipo de coisa que não se faz às cegas numa ferramenta que executa
// comandos. Lá o link abre em aba própria.
export default function DrawPage() {
  const [status, setStatus] = useState('checking'); // checking | ready | offline

  useEffect(() => {
    (async () => {
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
  }, []);

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
      // sandbox limita o que o app embutido pode fazer dentro do /admin.
      // allow-same-origin é necessário para o Excalidraw acessar o próprio
      // localStorage (é onde ele guarda os desenhos) — e é seguro aqui porque
      // a origem dele é OUTRA (draw.*), então isso não lhe dá acesso ao nosso
      // documento. Ficam de fora, entre outros, top-navigation e modals.
      sandbox="allow-scripts allow-same-origin allow-downloads allow-popups allow-forms"
    />
  );
}
