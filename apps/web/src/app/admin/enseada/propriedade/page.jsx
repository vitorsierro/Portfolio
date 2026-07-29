'use client';

import { useEffect, useState } from 'react';
import { ensureSession } from '../../../../lib/auth';
import { property } from '../../../../lib/enseada';
import admin from '../../../../styles/Admin.module.css';
import styles from '../../../../styles/Enseada.module.css';

const NUMERICOS = [
  'maxGuests',
  'bedrooms',
  'beds',
  'bathrooms',
  'areaM2',
  'basePriceFrom',
  'minNights',
];

export default function PropriedadePage() {
  const [form, setForm] = useState(null);
  const [status, setStatus] = useState('loading');
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await property.get();
        setForm({
          name: data.name ?? '',
          tagline: data.tagline ?? '',
          description: data.description ?? '',
          airbnbListingId: data.airbnbListingId ?? '',
          maxGuests: data.maxGuests ?? 0,
          bedrooms: data.bedrooms ?? 0,
          beds: data.beds ?? 0,
          bathrooms: data.bathrooms ?? 0,
          areaM2: data.areaM2 ?? 0,
          basePriceFrom: data.basePriceFrom ?? 0,
          minNights: data.minNights ?? 1,
          checkInTime: data.checkInTime ?? '15:00',
          checkOutTime: data.checkOutTime ?? '11:00',
          lat: data.lat ?? '',
          lng: data.lng ?? '',
          neighborhood: data.neighborhood ?? '',
          seoTitle: data.seoTitle ?? '',
          seoDescription: data.seoDescription ?? '',
          seoOgImage: data.seoOgImage ?? '',
        });
        setStatus('ready');
      } catch {
        setStatus('error');
      }
    })();
  }, []);

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function onSubmit(event) {
    event.preventDefault();
    setFeedback(null);

    const payload = { ...form };
    for (const key of NUMERICOS) payload[key] = Number(payload[key]) || 0;
    payload.lat = payload.lat === '' ? undefined : Number(payload.lat);
    payload.lng = payload.lng === '' ? undefined : Number(payload.lng);

    try {
      await property.save(payload);
      setFeedback({ type: 'ok', text: 'Salvo. O site será atualizado em instantes.' });
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    }
  }

  if (status === 'loading') return <p className={admin.state}>Carregando…</p>;
  if (status === 'error')
    return <p className={admin.state}>Não foi possível carregar a propriedade.</p>;

  return (
    <div className={admin.page}>
      <div className={admin.topbar}>
        <div>
          <h1 className={admin.title}>Propriedade</h1>
          <p className={admin.subtitle}>Dados que aparecem no site e no Google.</p>
        </div>
        <a className={admin.link} href="/admin/enseada">
          ← Voltar
        </a>
      </div>

      <form className={styles.form} onSubmit={onSubmit}>
        <div className={styles.fieldset}>
          <p className={styles.legend}>Identificação</p>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="name">
              Nome
            </label>
            <input
              id="name"
              className={admin.input}
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              required
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="tagline">
              Chamada
            </label>
            <input
              id="tagline"
              className={admin.input}
              value={form.tagline}
              onChange={(e) => set('tagline', e.target.value)}
              placeholder="Dois quartos a poucos passos da areia"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="description">
              Descrição
            </label>
            <textarea
              id="description"
              className={admin.textarea}
              style={{ minHeight: '10rem' }}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="airbnbListingId">
              ID do anúncio no Airbnb
            </label>
            <input
              id="airbnbListingId"
              className={admin.input}
              value={form.airbnbListingId}
              onChange={(e) => set('airbnbListingId', e.target.value)}
              required
            />
            {/* Sem este número o link com datas não funciona — é a peça de
                que o funil inteiro depende. */}
            <span className={styles.hint}>
              O número que aparece em airbnb.com/rooms/<strong>NUMERO</strong>.
              Sem ele o site não consegue mandar as datas escolhidas.
            </span>
          </div>
        </div>

        <div className={styles.fieldset}>
          <p className={styles.legend}>Capacidade</p>
          <div className={styles.grid2}>
            {[
              ['maxGuests', 'Hóspedes'],
              ['bedrooms', 'Quartos'],
              ['beds', 'Camas'],
              ['bathrooms', 'Banheiros'],
              ['areaM2', 'Área (m²)'],
              ['minNights', 'Noites mínimas'],
            ].map(([field, label]) => (
              <div className={styles.field} key={field}>
                <label className={styles.label} htmlFor={field}>
                  {label}
                </label>
                <input
                  id={field}
                  type="number"
                  min="0"
                  className={admin.input}
                  value={form[field]}
                  onChange={(e) => set(field, e.target.value)}
                />
              </div>
            ))}
          </div>
        </div>

        <div className={styles.fieldset}>
          <p className={styles.legend}>Preço e horários</p>
          <div className={styles.grid2}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="basePriceFrom">
                A partir de (R$/noite)
              </label>
              <input
                id="basePriceFrom"
                type="number"
                min="0"
                className={admin.input}
                value={form.basePriceFrom}
                onChange={(e) => set('basePriceFrom', e.target.value)}
              />
              <span className={styles.hint}>
                Só exibição. O valor final é sempre calculado no Airbnb.
              </span>
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="checkInTime">
                Check-in
              </label>
              <input
                id="checkInTime"
                className={admin.input}
                value={form.checkInTime}
                onChange={(e) => set('checkInTime', e.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="checkOutTime">
                Check-out
              </label>
              <input
                id="checkOutTime"
                className={admin.input}
                value={form.checkOutTime}
                onChange={(e) => set('checkOutTime', e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className={styles.fieldset}>
          <p className={styles.legend}>Localização</p>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="neighborhood">
              Bairro / cidade
            </label>
            <input
              id="neighborhood"
              className={admin.input}
              value={form.neighborhood}
              onChange={(e) => set('neighborhood', e.target.value)}
            />
            <span className={styles.hint}>
              Nunca coloque o endereço exato: o site mostra só a região.
            </span>
          </div>
          <div className={styles.grid2}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="lat">
                Latitude
              </label>
              <input
                id="lat"
                className={admin.input}
                value={form.lat}
                onChange={(e) => set('lat', e.target.value)}
                placeholder="-23.9915"
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="lng">
                Longitude
              </label>
              <input
                id="lng"
                className={admin.input}
                value={form.lng}
                onChange={(e) => set('lng', e.target.value)}
                placeholder="-46.2564"
              />
            </div>
          </div>
        </div>

        <div className={styles.fieldset}>
          <p className={styles.legend}>SEO</p>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="seoTitle">
              Título
            </label>
            <input
              id="seoTitle"
              className={admin.input}
              value={form.seoTitle}
              onChange={(e) => set('seoTitle', e.target.value)}
            />
            <span className={styles.hint}>Até ~60 caracteres no Google.</span>
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="seoDescription">
              Descrição
            </label>
            <textarea
              id="seoDescription"
              className={admin.textarea}
              style={{ minHeight: '6rem' }}
              value={form.seoDescription}
              onChange={(e) => set('seoDescription', e.target.value)}
            />
            <span className={styles.hint}>Até ~155 caracteres.</span>
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="seoOgImage">
              Imagem de compartilhamento (URL)
            </label>
            <input
              id="seoOgImage"
              className={admin.input}
              value={form.seoOgImage}
              onChange={(e) => set('seoOgImage', e.target.value)}
            />
          </div>
        </div>

        {feedback ? (
          <p
            className={feedback.type === 'ok' ? styles.ok : styles.error}
            role={feedback.type === 'ok' ? 'status' : 'alert'}
          >
            {feedback.text}
          </p>
        ) : null}

        <div className={admin.actions}>
          <button type="submit" className={`${admin.button} ${admin.primary}`}>
            Salvar
          </button>
        </div>
      </form>
    </div>
  );
}
