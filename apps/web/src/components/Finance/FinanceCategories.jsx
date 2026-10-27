"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authFetch, ensureSession } from "../../lib/auth";
import { ROUTER_LOGIN } from "../../constants";
import styles from "../../styles/Finance.module.css";

const money = (cents = 0) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const currentYear = new Date().getFullYear();
const yearChoices = Array.from({ length: currentYear - 1999 }, (_, index) => currentYear - index);
const yearColors = ["#157a57", "#4c86d9", "#a16ec1", "#df8a42", "#b54e4e", "#4f9a9a", "#76849b", "#b49a39", "#527a38", "#875b4b"];

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
  const [fromYear, setFromYear] = useState(Math.max(2020, currentYear - 4));
  const [toYear, setToYear] = useState(currentYear);
  const [categories, setCategories] = useState([]);
  const [summary, setSummary] = useState({ years: [], categories: [] });
  const [name, setName] = useState("");
  const [color, setColor] = useState("#16a34a");
  const [status, setStatus] = useState("loading");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const authenticated = await ensureSession();
      if (!authenticated) {
        router.replace(ROUTER_LOGIN);
        return;
      }
      const [categoryResponse, summaryResponse] = await Promise.all([
        authFetch("/admin/finance/categories"),
        authFetch(`/admin/finance/categories/annual-summary?fromYear=${fromYear}&toYear=${toYear}`),
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
      setCategories(Array.isArray(categoryData) ? categoryData : []);
      setSummary(summaryData);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [fromYear, toYear, router]);

  useEffect(() => {
    load();
  }, [load]);

  const summaryCategories = useMemo(() => summary.categories ?? [], [summary.categories]);
  const maxAnnualAmount = Math.max(
    1,
    ...summaryCategories.flatMap((category) => category.totals.map((item) => item.amountCents)),
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
        <div className={styles.yearRange}>
          <label>
            De
            <select aria-label="Ano inicial" value={fromYear} onChange={(event) => {
              const selectedYear = Number(event.target.value);
              setFromYear(selectedYear);
              if (selectedYear > toYear) setToYear(selectedYear);
            }}>
              {yearChoices.map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
          </label>
          <label>
            Até
            <select aria-label="Ano final" value={toYear} onChange={(event) => setToYear(Number(event.target.value))}>
              {yearChoices.filter((year) => year >= fromYear).map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
          </label>
        </div>
      </div>

      <section className={styles.panel} aria-labelledby="annual-category-title">
        <div className={styles.panelHeading}>
          <div>
            <h2 id="annual-category-title">Gastos anuais por categoria</h2>
            <p>Despesas registradas entre {fromYear} e {toYear}; lançamentos em “Lixo” ficam fora dos totais.</p>
          </div>
        </div>
        {status === "loading" ? (
          <div className={styles.loading}>Carregando categorias…</div>
        ) : status === "error" ? (
          <div className={styles.error}>
            Não foi possível carregar o gerenciador.{" "}
            <button type="button" onClick={load}>Tentar novamente</button>
          </div>
        ) : summaryCategories.length ? (
          <div className={styles.annualChart} role="img" aria-label={`Gastos por categoria de ${fromYear} a ${toYear}`}>
            {summaryCategories.map((category) => {
              const rangeTotal = category.totals.reduce((total, item) => total + item.amountCents, 0);
              return (
                <div className={styles.annualCategory} key={category.id}>
                  <div className={styles.annualCategoryHeading}>
                    <strong>{category.name}</strong>
                    <strong>{money(rangeTotal)}</strong>
                  </div>
                  {category.totals.map((item, index) => (
                    <div className={styles.annualBarRow} key={item.year}>
                      <span>{item.year}</span>
                      <div className={styles.annualBarTrack}>
                        <span
                          className={styles.annualBar}
                          style={{
                            width: `${Math.max(0, (item.amountCents / maxAnnualAmount) * 100)}%`,
                            backgroundColor: yearColors[index % yearColors.length],
                          }}
                          title={`${category.name} — ${item.year}: ${money(item.amountCents)}`}
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
      </section>

      <section className={styles.categoryManagerGrid}>
        <div className={styles.panel}>
          <div className={styles.panelHeading}>
            <div>
              <h2>Categorias</h2>
              <p>Filtre o histórico completo de uma categoria.</p>
            </div>
          </div>
          {categories.length ? (
            <div className={styles.managedCategoryList}>
              {categoriesWithTotals.map((category) => {
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
              {summaryCategories.find((category) => category.id === "uncategorized") && (
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
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHeading}>
            <div>
              <h2>Nova categoria</h2>
              <p>Crie uma categoria para organizar os lançamentos.</p>
            </div>
          </div>
          <form className={styles.categoryManagerForm} onSubmit={addCategory}>
            <label htmlFor="managed-category-name">Nome</label>
            <input
              id="managed-category-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={60}
              required
              placeholder="Ex.: Moradia"
            />
            <label htmlFor="managed-category-color">Cor</label>
            <input
              id="managed-category-color"
              className={styles.colorInput}
              type="color"
              value={color}
              onChange={(event) => setColor(event.target.value)}
              aria-label="Cor da categoria"
            />
            <button className={styles.primaryButton} type="submit" disabled={saving}>
              {saving ? "Criando…" : "Criar categoria"}
            </button>
            {message && <p className={styles.formMessage} role="status">{message}</p>}
          </form>
        </div>
      </section>
    </main>
  );
}
