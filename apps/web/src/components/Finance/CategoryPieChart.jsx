"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "../../styles/Finance.module.css";

const money = (value) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value / 100);
const percent = (value) => new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 }).format(value);
const colors = ["#176b4b", "#417bb8", "#d89038", "#985cb1", "#c75c64", "#399390", "#7d8740", "#ad6540", "#646ab1", "#bc6b9b", "#368163", "#4a7089", "#8f652c", "#684682", "#a23846", "#1d7571", "#62701e", "#924b22", "#484d8c", "#a0447c", "#6b9a55", "#5774a3", "#b87c52", "#81619a"];

function slicePath(start, share) {
  const point = (angle) => [120 + 104 * Math.cos(angle), 120 + 104 * Math.sin(angle)];
  const a = point(start);
  if (share >= 1) return "M 120 16 A 104 104 0 1 1 120 224 A 104 104 0 1 1 120 16 Z";
  const b = point(start + share * Math.PI * 2);
  return `M 120 120 L ${a[0]} ${a[1]} A 104 104 0 ${share > 0.5 ? 1 : 0} 1 ${b[0]} ${b[1]} Z`;
}

export function CategoryPieChart({ categories }) {
  const [selectedId, setSelectedId] = useState(null);
  const [hiddenIds, setHiddenIds] = useState([]);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("finance:pie:hidden-categories") ?? "[]");
      if (Array.isArray(saved)) setHiddenIds(saved.filter((id) => typeof id === "string"));
    } catch { /* A preferência é opcional. */ }
  }, []);
  function updateHidden(next) {
    setHiddenIds(next);
    try { localStorage.setItem("finance:pie:hidden-categories", JSON.stringify(next)); } catch { /* A preferência é opcional. */ }
  }
  const eligible = useMemo(() => categories.filter((category) => category.calculation !== "net-investment-flow" && !category.excludedFromTotals)
      .map((category) => ({ ...category, amount: category.totals.reduce((sum, row) => sum + row.amountCents, 0) }))
      .filter((category) => category.amount > 0).sort((a, b) => b.amount - a.amount)
      .map((entry, index) => ({ ...entry, color: colors[index % colors.length] })), [categories]);
  const data = useMemo(() => {
    const entries = eligible.filter((category) => !hiddenIds.includes(category.id));
    const total = entries.reduce((sum, row) => sum + row.amount, 0);
    let angle = -Math.PI / 2;
    return { total, entries: entries.map((entry) => {
      const share = entry.amount / total;
      const slice = { ...entry, share, path: slicePath(angle, share) };
      angle += share * Math.PI * 2;
      return slice;
    }) };
  }, [eligible, hiddenIds]);
  const selected = data.entries.find((entry) => entry.id === selectedId) ?? data.entries[0];
  return (
    <>
      <details className={styles.pieVisibility}>
        <summary>Categorias no gráfico ({data.entries.length} de {eligible.length})</summary>
        <p>Desmarque para ocultar apenas nesta pizza. Os valores e percentuais consideram as categorias visíveis.</p>
        <button type="button" className={styles.secondaryButton} onClick={() => updateHidden([])} disabled={!hiddenIds.length}>Mostrar todas</button>
        <div className={styles.pieVisibilityOptions}>
          {eligible.map((entry) => (
            <label key={entry.id}>
              <input type="checkbox" checked={!hiddenIds.includes(entry.id)} onChange={(event) => updateHidden(event.target.checked ? hiddenIds.filter((id) => id !== entry.id) : [...hiddenIds, entry.id])} />
              <span>{entry.name}</span>
            </label>
          ))}
        </div>
      </details>
    {!data.entries.length ? <div className={styles.emptyState}>{eligible.length ? "Todas as categorias estão ocultas. Selecione uma categoria acima para exibir o gráfico." : "Sem gastos para distribuir neste intervalo."}</div> : (
    <div className={styles.pieLayout}>
      <div className={styles.pieFigure}>
        <svg viewBox="0 0 240 240" role="img" aria-label={`Distribuição dos gastos por categoria. Total: ${money(data.total)}`}>
          {data.entries.map((entry) => (
            <path key={entry.id} d={entry.path} fill={entry.color} stroke="#fff" strokeWidth="2"
              className={styles.pieSlice} opacity={selectedId && selectedId !== entry.id ? 0.55 : 1}
              onMouseEnter={() => setSelectedId(entry.id)}>
              <title>{entry.name}: {money(entry.amount)} ({percent(entry.share)})</title>
            </path>
          ))}
        </svg>
        <div className={styles.pieDetail} aria-live="polite">
          <span>{selected.name}</span><strong>{money(selected.amount)}</strong><small>{percent(selected.share)} dos gastos</small>
        </div>
        <div className={styles.pieTotal}><span>Total de gastos visíveis</span><strong>{money(data.total)}</strong></div>
      </div>
      <ul className={styles.pieLegend} aria-label="Participação de cada categoria nos gastos">
        {data.entries.map((entry) => (
          <li key={entry.id}>
            <button type="button" aria-pressed={selectedId === entry.id} onClick={() => setSelectedId(entry.id)} onFocus={() => setSelectedId(entry.id)} onMouseEnter={() => setSelectedId(entry.id)}>
              <span className={styles.categoryDot} style={{ background: entry.color }} />
              <span className={styles.pieLegendName}>{entry.name}</span>
              <span className={styles.pieLegendAmount}>{money(entry.amount)}<small>{percent(entry.share)}</small></span>
            </button>
          </li>
        ))}
      </ul>
    </div>
    )}
    </>
  );
}
