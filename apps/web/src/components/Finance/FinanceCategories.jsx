"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authFetch, ensureSession } from "../../lib/auth";
import { ROUTER_LOGIN } from "../../constants";
import styles from "../../styles/Finance.module.css";
import { CategoryPieChart } from "./CategoryPieChart";

const money = (cents = 0) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const yearColors = ["#157a57", "#4c86d9", "#a16ec1", "#df8a42", "#b54e4e", "#4f9a9a", "#76849b", "#b49a39", "#527a38", "#875b4b"];

function CollapsiblePanel({ id, title, description, children, collapsed, onToggle }) {
  return (
    <section className={styles.panel} aria-labelledby={`${id}-title`}>
      <div className={`${styles.panelHeading} ${styles.collapsibleHeading}`}>
        <h2 id={`${id}-title`}>{title}</h2>
        <button type="button" className={styles.collapseButton} aria-expanded={!collapsed} aria-controls={`${id}-content`}
          aria-label={`${collapsed ? "Expandir" : "Minimizar"} ${title}`} onClick={onToggle}>
          <span aria-hidden="true">{collapsed ? "+" : "−"}</span> {collapsed ? "Expandir" : "Minimizar"}
        </button>
        <p>{description}</p>
      </div>
      <div id={`${id}-content`} hidden={collapsed}>{children}</div>
    </section>
  );
}

function Navigation() {
  return (
    <nav className={styles.financeNav} aria-label="Seções de finanças">
      <Link href="/admin/finance">Visão geral</Link>
      <Link href="/admin/finance/transactions">Movimentações</Link>
      <Link className={styles.navActive} href="/admin/finance/categories">Categorias</Link>
      <Link href="/admin/finance/investments">Investimentos</Link>
    </nav>
  );
}

export function FinanceCategories() {
  const router = useRouter();
  const [fromYear, setFromYear] = useState(null);
  const [toYear, setToYear] = useState(null);
  const [categories, setCategories] = useState([]);
  const [summary, setSummary] = useState({ years: [], categories: [] });
  const [name, setName] = useState("");
  const [color, setColor] = useState("#16a34a");
  const [status, setStatus] = useState("loading");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [collapsed, setCollapsed] = useState({ annual: false, pie: false, categories: false });
  const [hiddenCategories, setHiddenCategories] = useState([]);
  const loadVersion = useRef(0);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("finance:category-list:hidden") ?? "[]");
      if (Array.isArray(saved)) setHiddenCategories(saved.filter((id) => typeof id === "string"));
    } catch { /* Preferência opcional. */ }
    try {
      const saved = JSON.parse(localStorage.getItem("finance:categories:collapsed") ?? "null");
      if (saved) setCollapsed({ annual: saved.annual === true, pie: saved.pie === true, categories: saved.categories === true });
    } catch { /* The page remains usable if storage is unavailable. */ }
  }, []);

  function updateHiddenCategories(next) {
    setHiddenCategories(next);
    try { localStorage.setItem("finance:category-list:hidden", JSON.stringify(next)); } catch { /* Preferência opcional. */ }
  }

  function togglePanel(panel) {
    const next = { ...collapsed, [panel]: !collapsed[panel] };
    setCollapsed(next);
    try { localStorage.setItem("finance:categories:collapsed", JSON.stringify(next)); } catch { /* Optional preference. */ }
  }

  const load = useCallback(async () => {
    const version = ++loadVersion.current;
    setStatus("loading");
    try {
      const authenticated = await ensureSession();
      if (!authenticated) {
        router.replace(ROUTER_LOGIN);
        return;
      }
      const params = new URLSearchParams();
      if (fromYear !== null) params.set("fromYear", String(fromYear));
      if (toYear !== null) params.set("toYear", String(toYear));
      const query = params.toString();
      const [categoryResponse, summaryResponse] = await Promise.all([
        authFetch("/admin/finance/categories"),
        authFetch(`/admin/finance/categories/annual-summary${query ? `?${query}` : ""}`),
      ]);
      if (categoryResponse.status === 401 || summaryResponse.status === 401) {
        router.replace(ROUTER_LOGIN);
        return;
      }
      if (!categoryResponse.ok || !summaryResponse.ok) {
        setStatus("error");
        return;
      }
      const [categoryData, summaryData] = await Promise.all([
        categoryResponse.json(),
        summaryResponse.json(),
      ]);
      if (version !== loadVersion.current) return;
      setCategories(Array.isArray(categoryData) ? categoryData : []);
      setSummary(summaryData);
      setStatus("ready");
    } catch {
      if (version === loadVersion.current) setStatus("error");
    }
  }, [fromYear, toYear, router]);

  useEffect(() => {
    load();
    return () => { loadVersion.current += 1; };
  }, [load]);

  const summaryCategories = useMemo(() => summary.categories ?? [], [summary.categories]);
  const availableYears = useMemo(() => [...(summary.availableYears ?? summary.years ?? [])].sort((a, b) => a - b), [summary.availableYears, summary.years]);
  const yearChoices = [...availableYears].reverse();
  const visibleYears = (summary.years ?? []).filter((year) => availableYears.includes(year));
  const displayFromYear = fromYear ?? visibleYears[0] ?? "";
  const displayToYear = toYear ?? visibleYears.at(-1) ?? "";
  const maxAnnualAmount = Math.max(
    1,
    ...summaryCategories.flatMap((category) => category.totals.map((item) => Math.abs(item.amountCents))),
  );
  const categoriesWithTotals = useMemo(
    () => categories.map((category) => ({
      ...category,
      totals: summaryCategories.find((item) => item.id === category.id)?.totals ?? [],
    })),
    [categories, summaryCategories],
  );

  async function addCategory(event) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const response = await authFetch("/admin/finance/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), color }),
      });
      if (response.status === 401) {
        router.replace(ROUTER_LOGIN);
        return;
      }
      if (!response.ok) {
        setMessage("Não foi possível criar a categoria. Confira se ela já existe.");
        return;
      }
      setName("");
      setMessage("Categoria criada.");
      await load();
    } catch {
      setMessage("Não foi possível criar a categoria agora.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className={styles.page}>
      <Navigation />
      <div className={styles.pageTop}>
        <div>
          <p className={styles.kicker}>ORGANIZAÇÃO</p>
          <h1>Gerenciador de categorias</h1>
          <p className={styles.subtitle}>
            Compare as despesas por categoria ano a ano e abra todos os lançamentos de cada uma.
          </p>
        </div>
      </div>

      <section className={styles.panel} aria-labelledby="new-category-title">
        <div className={styles.panelHeading}><div><h2 id="new-category-title">Nova categoria</h2><p>Crie uma categoria para organizar os lançamentos.</p></div></div>
        <form className={`${styles.categoryManagerForm} ${styles.categoryQuickForm}`} onSubmit={addCategory}>
          <label htmlFor="managed-category-name">Nome
            <input id="managed-category-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={60} required placeholder="Ex.: Moradia — Reparos" />
          </label>
          <label htmlFor="managed-category-color">Cor
            <input id="managed-category-color" className={styles.colorInput} type="color" value={color} onChange={(event) => setColor(event.target.value)} aria-label="Cor da categoria" />
          </label>
          <button className={styles.primaryButton} type="submit" disabled={saving}>{saving ? "Criando…" : "Criar categoria"}</button>
          {message && <p className={styles.formMessage} role="status">{message}</p>}
        </form>
      </section>

      <div className={styles.chartPeriodToolbar}>
        <span>Período dos gráficos</span>
        <div className={styles.yearRange}>
          <label>
            De
            <select aria-label="Ano inicial" value={displayFromYear} disabled={!availableYears.length} onChange={(event) => {
              const selectedYear = Number(event.target.value);
              setFromYear(selectedYear);
              if (selectedYear > displayToYear) setToYear(selectedYear);
            }}>
              {!availableYears.length && <option value="">Sem dados</option>}
              {yearChoices.map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
          </label>
          <label>
            Até
            <select aria-label="Ano final" value={displayToYear} disabled={!availableYears.length} onChange={(event) => setToYear(Number(event.target.value))}>
              {!availableYears.length && <option value="">Sem dados</option>}
              {yearChoices.filter((year) => year >= displayFromYear).map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
          </label>
        </div>
      </div>

      <CollapsiblePanel id="annual-category" title="Gastos anuais por categoria" collapsed={collapsed.annual} onToggle={() => togglePanel("annual")}
        description={visibleYears.length ? `Dados de ${displayFromYear} a ${displayToYear}. Categorias excluídas não entram nos totais.` : "O comparativo usa apenas os anos com transações."}>
        {status === "loading" ? (
          <div className={styles.loading}>Carregando categorias…</div>
        ) : status === "error" ? (
          <div className={styles.error}>
            Não foi possível carregar o gerenciador.{" "}
            <button type="button" onClick={load}>Tentar novamente</button>
          </div>
        ) : summaryCategories.length ? (
          <div className={styles.annualChart} role="img" aria-label={`Gastos por categoria de ${displayFromYear} a ${displayToYear}`}>
            {summaryCategories.map((category) => {
              const rangeTotal = category.totals.reduce((total, item) => total + item.amountCents, 0);
              return (
                <div className={styles.annualCategory} key={category.id}>
                  <div className={styles.annualCategoryHeading}>
                    <strong>{category.name}</strong>
                    <strong>{money(rangeTotal)}</strong>
                  </div>
                  {category.calculation === "net-investment-flow" && (
                    <p className={styles.investmentFlowNote}>Aplicações menos resgates e vendas recebidos. Negativo indica mais retiradas no período; este valor não é o saldo da carteira.</p>
                  )}
                  {category.totals.filter((item) => visibleYears.includes(item.year)).map((item, index) => (
                    <div className={styles.annualBarRow} key={item.year}>
                      <span>{item.year}</span>
                      <div className={styles.annualBarTrack}>
                        <span
                          className={styles.annualBar}
                          style={{
                            width: `${(Math.abs(item.amountCents) / maxAnnualAmount) * 100}%`,
                            backgroundColor: yearColors[index % yearColors.length],
                          }}
                          title={category.calculation === "net-investment-flow"
                            ? `${item.year}: aplicações ${money(item.applicationsCents)}, resgates e vendas ${money(item.withdrawalsCents)}, líquido ${money(item.amountCents)}`
                            : `${category.name} — ${item.year}: ${money(item.amountCents)}`}
                        />
                      </div>
                      <span className={styles.annualBarValue}>{money(item.amountCents)}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ) : (
          <div className={styles.emptyState}>Sem despesas categorizadas neste intervalo.</div>
        )}
      </CollapsiblePanel>

      <CollapsiblePanel id="category-pie" title="Gráfico de pizza por categoria" collapsed={collapsed.pie} onToggle={() => togglePanel("pie")}
        description="Participação nos gastos do período selecionado. Investimentos líquidos e categorias excluídas ficam fora desta distribuição.">
        {status === "loading" ? <div className={styles.loading}>Carregando gráfico…</div>
          : status === "error" ? <div className={styles.error}>Não foi possível carregar o gráfico.</div>
            : <CategoryPieChart categories={summaryCategories} />}
      </CollapsiblePanel>

      <CollapsiblePanel id="managed-categories" title="Categorias" description="Filtre o histórico completo de uma categoria."
        collapsed={collapsed.categories} onToggle={() => togglePanel("categories")}>
          <details className={styles.pieVisibility}>
            <summary>Categorias visíveis na lista</summary>
            <p>Desmarque para ocultar somente nesta lista. Sua seleção fica salva neste navegador.</p>
            <button type="button" className={styles.secondaryButton} disabled={!hiddenCategories.length} onClick={() => updateHiddenCategories([])}>Mostrar todas as categorias da lista</button>
            <div className={styles.pieVisibilityOptions}>
              {[...categories, ...(summaryCategories.some((category) => category.id === "uncategorized") ? [{ id: "uncategorized", name: "Sem categoria" }] : [])].map((category) => (
                <label key={category.id}><input type="checkbox" checked={!hiddenCategories.includes(category.id)} onChange={(event) => updateHiddenCategories(event.target.checked ? hiddenCategories.filter((id) => id !== category.id) : [...hiddenCategories, category.id])} /><span>{category.name}</span></label>
              ))}
            </div>
          </details>
          {categories.length ? (
            <div className={styles.managedCategoryList}>
              {categoriesWithTotals.filter((category) => !hiddenCategories.includes(category.id)).map((category) => {
                const total = category.totals.reduce((sum, item) => sum + item.amountCents, 0);
                return (
                  <article className={styles.managedCategory} key={category.id}>
                    <span className={styles.categoryDot} style={{ background: category.color }} />
                    <div>
                      <strong>{category.name}</strong>
                      {category.excludedFromTotals && <small>Excluída dos totais e gráficos gerais</small>}
                    </div>
                    <strong className={styles.managedCategoryTotal}>{category.excludedFromTotals ? "—" : money(total)}</strong>
                    <Link
                      href={`/admin/finance/transactions?categoryId=${encodeURIComponent(category.id)}&period=all`}
                      aria-label={`Ver todos os lançamentos de ${category.name}`}
                    >
                      Ver lançamentos
                    </Link>
                  </article>
                );
              })}
              {!hiddenCategories.includes("uncategorized") && summaryCategories.find((category) => category.id === "uncategorized") && (
                <article className={styles.managedCategory}>
                  <span className={styles.categoryDot} style={{ background: "#a3b7ad" }} />
                  <div><strong>Sem categoria</strong></div>
                  <strong className={styles.managedCategoryTotal}>
                    {money(summaryCategories.find((category) => category.id === "uncategorized").totals.reduce((sum, item) => sum + item.amountCents, 0))}
                  </strong>
                  <Link href="/admin/finance/transactions?categoryId=uncategorized&period=all">Ver lançamentos</Link>
                </article>
              )}
            </div>
          ) : (
            <div className={styles.emptyState}>Ainda não há categorias cadastradas.</div>
          )}
      </CollapsiblePanel>
    </main>
  );
}
