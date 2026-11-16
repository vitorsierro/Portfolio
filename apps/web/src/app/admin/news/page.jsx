'use client';

import { useState } from 'react';
import { threadRequest } from '../../../lib/threadApi';
import styles from '../../../styles/ThreadReader.module.css';

export default function NewsReaderPage() {
  const [sourceUrl, setSourceUrl] = useState('');
  const [article, setArticle] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function openArticle(event) {
    event.preventDefault(); setBusy(true); setError(''); setArticle(null);
    try {
      setArticle(await threadRequest('/admin/news/import', { method: 'POST', body: JSON.stringify({ sourceUrl }) }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível abrir a notícia.'); }
    finally { setBusy(false); }
  }
  return (
    <main className={styles.shell}>
      <header className={styles.masthead}><div>
        <p className={styles.kicker}>Leitor de notícias</p>
        <h1 className={styles.title}>A notícia, sem distrações.</h1>
        <p className={styles.subtitle}>Abra o texto disponível no site em uma leitura contínua, sem anúncios ou janelas sobre a matéria.</p>
      </div></header>
      <section className={styles.panel}>
        <form className={styles.importForm} onSubmit={openArticle}>
          <label className={styles.fieldLabel} htmlFor="news-url">Link da notícia</label>
          <div className={styles.inputRow}>
            <input className={styles.textInput} id="news-url" type="url" required maxLength={2048} value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://www.uol.com.br/…" />
            <button className={styles.primaryButton} type="submit" disabled={busy}>{busy ? 'Abrindo…' : 'Abrir notícia'}</button>
          </div>
          <p className={styles.formHint}>UOL, Folha, Globo, Estadão, CNN Brasil e BBC. A disponibilidade do texto depende de cada site.</p>
        </form>
        {error && <p className={`${styles.message} ${styles.errorMessage}`} role="alert">{error}</p>}
      </section>
      {article && <article className={styles.readArticle}>
        <header className={styles.threadHeader}>
          <p className={styles.kicker}>{new URL(article.sourceUrl).hostname}</p>
          <h2 className={styles.readerTitle}>{article.title}</h2>
          <div className={styles.threadMeta}><span>{article.author}</span><a className={styles.sourceLink} href={article.sourceUrl} target="_blank" rel="noreferrer">Abrir fonte original ↗</a></div>
          {article.restricted && <p className={styles.formHint}>Esta matéria é marcada como exclusiva pelo site. A leitura contém apenas o texto enviado na página; trechos restritos podem estar ausentes.</p>}
        </header>
        <div className={styles.readerBody}>{article.paragraphs.map((paragraph, index) => <p className={styles.postText} key={index}>{paragraph}</p>)}</div>
      </article>}
    </main>
  );
}
