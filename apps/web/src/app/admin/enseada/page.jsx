'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ensureSession } from '../../../lib/auth';
import styles from '../../../styles/Admin.module.css';

const SECOES = [
  {
    href: '/admin/enseada/propriedade',
    name: 'Propriedade',
    description: 'Dados básicos, ID do anúncio, preço base e textos de SEO.',
  },
  {
    href: '/admin/enseada/ambientes',
    name: 'Ambientes',
    description: 'Quartos, sala, cozinha e áreas — com galeria de fotos.',
  },
  {
    href: '/admin/enseada/amenidades',
    name: 'Amenidades',
    description: 'Lista de comodidades agrupadas por categoria.',
  },
  {
    href: '/admin/enseada/guia',
    name: 'Guia local',
    description: 'Restaurantes e atividades — a parte que traz tráfego orgânico.',
  },
  {
    href: '/admin/enseada/faq',
    name: 'Perguntas frequentes',
    description: 'Vira FAQPage no Google, com destaque no resultado.',
  },
  {
    href: '/admin/enseada/preview',
    name: 'Preview do JSON',
    description: 'Exatamente o que a API entrega ao site.',
  },
];

export default function EnseadaHub() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      if (!(await ensureSession())) {
        router.replace('/admin/login');
        return;
      }
      setReady(true);
    })();
  }, [router]);

  if (!ready) return <p className={styles.state}>Carregando…</p>;

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <div>
          <h1 className={styles.title}>Enseada</h1>
          <p className={styles.subtitle}>
            Conteúdo do site de temporada. As mudanças vão para o ar em poucos
            minutos.
          </p>
        </div>
      </div>

      <div className={styles.toolGrid}>
        {SECOES.map((secao) => (
          <a className={styles.toolCard} href={secao.href} key={secao.href}>
            <span className={styles.toolName}>{secao.name}</span>
            <span className={styles.toolDescription}>{secao.description}</span>
            <span className={styles.toolOpen}>Abrir →</span>
          </a>
        ))}
      </div>
    </div>
  );
}
