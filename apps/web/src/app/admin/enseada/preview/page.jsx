'use client';

import { useEffect, useState } from 'react';
import { preview } from '../../../../lib/enseada';
import admin from '../../../../styles/Admin.module.css';
import styles from '../../../../styles/Enseada.module.css';

/**
 * Mostra o JSON exatamente como a API pública devolve. Serve para conferir o
 * que o site vai receber antes de culpar o site por um conteúdo faltando.
 */
export default function PreviewPage() {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    (async () => {
      try {
        setData(await preview());
        setStatus('ready');
      } catch {
        setStatus('error');
      }
    })();
  }, []);

  if (status === 'loading') return <p className={admin.state}>Carregando…</p>;
  if (status === 'error')
    return <p className={admin.state}>Não foi possível gerar o preview.</p>;

  const resumo = [
    ['Ambientes', data.spaces.length],
    ['Fotos', data.spaces.reduce((n, s) => n + s.images.length, 0)],
    ['Amenidades', data.amenities.length],
    ['Restaurantes', data.guide.restaurants.length],
    ['Atividades', data.guide.activities.length],
    ['FAQ', data.faq.length],
  ];

  const faltando = [
    !data.property.airbnbListingId && 'ID do anúncio no Airbnb',
    !data.property.name && 'nome da propriedade',
    data.spaces.length === 0 && 'nenhum ambiente cadastrado',
    !data.seo.title && 'título de SEO',
  ].filter(Boolean);

  return (
    <div className={admin.page}>
      <div className={admin.topbar}>
        <div>
          <h1 className={admin.title}>Preview do JSON</h1>
          <p className={admin.subtitle}>
            É exatamente isto que o site recebe da API.
          </p>
        </div>
        <a className={admin.link} href="/admin/enseada">
          ← Voltar
        </a>
      </div>

      <div className={admin.toolGrid}>
        {resumo.map(([label, value]) => (
          <div className={admin.toolCard} key={label}>
            <span className={admin.toolName}>{value}</span>
            <span className={admin.toolDescription}>{label}</span>
          </div>
        ))}
      </div>

      {faltando.length > 0 ? (
        <p className={styles.error} role="status">
          Ainda falta: {faltando.join(', ')}.
        </p>
      ) : (
        <p className={styles.ok} role="status">
          Conteúdo completo para publicar.
        </p>
      )}

      <pre className={styles.preview}>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}
