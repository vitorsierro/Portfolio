"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authFetch, ensureSession } from "../../lib/auth";
import { ROUTER_LOGIN } from "../../constants";
import styles from "../../styles/Finance.module.css";
import { FinanceInvestments } from "./FinanceInvestments";
export { FinanceInvestments };

const PluggyConnect = dynamic(
  () => import("react-pluggy-connect").then((module) => module.PluggyConnect),
  { ssr: false },
);

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const money = (cents = 0) => currency.format(cents / 100);
const localDateString = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};
const currentMonth = () => localDateString().slice(0, 7);
const queryParam = (name) =>
  typeof window === "undefined"
    ? null
    : new URLSearchParams(window.location.search).get(name);
const monthLabel = (month) =>
  new Date(`${month}-15T12:00:00`).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
const dateLabel = (value) => {
  const [year, month, day] = String(value).slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
};
const percentChange = (current, previous) =>
  previous ? ((current - previous) / previous) * 100 : null;
const PLUGGY_STALE_OVERVIEW_MESSAGE =
  "Não foi possível atualizar a Pluggy agora; exibindo os últimos dados sincronizados.";
const PLUGGY_STALE_TRANSACTIONS_MESSAGE =
  "Exibindo os últimos lançamentos sincronizados; a atualização da Pluggy falhou.";

function FinanceNavigation({ active }) {
  return (
    <nav className={styles.financeNav} aria-label="Seções de finanças">
      <Link className={active === "overview" ? styles.navActive : ""} href="/admin/finance">Visão geral</Link>
      <Link className={active === "transactions" ? styles.navActive : ""} href="/admin/finance/transactions">Movimentações</Link>
      <Link className={active === "categories" ? styles.navActive : ""} href="/admin/finance/categories">Categorias</Link>
      <Link className={active === "investments" ? styles.navActive : ""} href="/admin/finance/investments">Investimentos</Link>
    </nav>
  );
}

function MonthPicker({ month, onChange }) {
  const move = (delta) => {
    const [year, monthIndex] = month.split("-").map(Number);
    const date = new Date(year, monthIndex - 1 + delta, 1);
    onChange(
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
    );
  };
  return (
    <div className={styles.monthPicker}>
      <button type="button" aria-label="Mês anterior" onClick={() => move(-1)}>
        ‹
      </button>
      <span>{monthLabel(month)}</span>
      <button
        type="button"
        aria-label="Próximo mês"
        onClick={() => move(1)}
        disabled={month >= currentMonth()}
      >
        ›
      </button>
    </div>
  );
}

function Change({ current, previous, higherIsBetter = false }) {
  const value = percentChange(current, previous);
  if (value === null)
    return <span className={styles.muted}>Sem comparação anterior</span>;
  const favorable = higherIsBetter ? value >= 0 : value <= 0;
  return (
    <span className={favorable ? styles.goodChange : styles.badChange}>
      {value > 0 ? "↑" : value < 0 ? "↓" : "→"}{" "}
      {Math.abs(value).toFixed(1).replace(".", ",")}% vs. mês anterior
    </span>
  );
}

function LineChart({ values = [] }) {
  const max = Math.max(1, ...values.map((item) => item.expensesCents));
  const points = values
    .map((item, index) => {
      const x = values.length <= 1 ? 0 : (index / (values.length - 1)) * 100;
      const y = 90 - (item.expensesCents / max) * 78;
      return `${x},${y}`;
    })
    .join(" ");
  const area = values.length ? `0,100 ${points} 100,100` : "";
  return (
    <div className={styles.chartWrap}>
      {values.length ? (
        <svg
          className={styles.chart}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          role="img"
          aria-label="Despesas diárias no mês"
        >
          <defs>
            <linearGradient id="financeFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#43d9a3" stopOpacity=".28" />
              <stop offset="100%" stopColor="#43d9a3" stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon points={area} fill="url(#financeFill)" />
          <polyline
            points={points}
            fill="none"
            stroke="#138a63"
            strokeWidth="1.4"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      ) : (
        <p className={styles.emptyInline}>Sem despesas neste período.</p>
      )}
      <div className={styles.chartAxis}>
        <span>01</span>
        <span>10</span>
        <span>20</span>
        <span>{String(values.length).padStart(2, "0")}</span>
      </div>
    </div>
  );
}

export function FinanceDashboard() {
  const router = useRouter();
  const [month, setMonth] = useState(currentMonth);
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("loading");
  const [connections, setConnections] = useState([]);
  const [connectToken, setConnectToken] = useState(null);
  const [pluggyBusy, setPluggyBusy] = useState(false);
  const [pluggyMessage, setPluggyMessage] = useState("");
  const [pluggySyncUnavailable, setPluggySyncUnavailable] = useState(false);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const authenticated = await ensureSession();
      if (!authenticated) {
        router.replace(ROUTER_LOGIN);
        return;
      }
      const [response, connectionsResponse] = await Promise.all([
        authFetch(`/admin/finance/overview?month=${month}`),
        authFetch("/admin/finance/pluggy/connections"),
      ]);
      if (response.status === 401 || connectionsResponse.status === 401) {
        router.replace(ROUTER_LOGIN);
        return;
      }
      if (!response.ok || !connectionsResponse.ok) {
        setStatus("error");
        return;
      }
      const [overview, connectionData] = await Promise.all([
        response.json(),
        connectionsResponse.json(),
      ]);
      setData(overview);
      setConnections(Array.isArray(connectionData) ? connectionData : []);
      setPluggySyncUnavailable(Boolean(overview.pluggySyncUnavailable));
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [month, router]);

  useEffect(() => {
    load();
  }, [load]);
  const totals = data?.totals;
  const topCategory = useMemo(() => data?.categories?.[0], [data]);
  const maxCategory = Math.max(
    1,
    ...(data?.categories ?? []).map((item) => item.amountCents),
  );

  async function startPluggyConnect() {
    setPluggyBusy(true);
    setPluggyMessage("");
    try {
      const response = await authFetch("/admin/finance/pluggy/connect-token", {
        method: "POST",
      });
      if (response.status === 401) {
        router.replace(ROUTER_LOGIN);
        return;
      }
      if (!response.ok) {
        setPluggyMessage(
          "A conexão bancária ainda não está configurada no servidor.",
        );
        return;
      }
      const result = await response.json();
      setConnectToken(result.accessToken);
    } catch {
      setPluggyMessage("Não foi possível iniciar a conexão com a Pluggy.");
    } finally {
      setPluggyBusy(false);
    }
  }

  async function finishPluggyConnect({ item }) {
    setConnectToken(null);
    setPluggyBusy(true);
    setPluggyMessage("");
    try {
      const response = await authFetch("/admin/finance/pluggy/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.id }),
      });
      if (response.status === 401) {
        router.replace(ROUTER_LOGIN);
        return;
      }
      if (!response.ok) {
        setPluggyMessage("A instituição conectou, mas não foi possível vinculá-la.");
        return;
      }
      const syncResponse = await authFetch("/admin/finance/pluggy/sync", {
        method: "POST",
      });
      if (syncResponse.status === 401) {
        router.replace(ROUTER_LOGIN);
        return;
      }
      const syncResult = syncResponse.ok ? await syncResponse.json() : null;
      setPluggyMessage(
        syncResult?.pendingConnections
          ? "Instituição conectada; ela ainda está buscando os dados. Tente atualizar em alguns instantes."
          : syncResponse.ok
            ? "Instituição conectada. Os lançamentos foram sincronizados."
            : "Instituição conectada; a sincronização poderá ser repetida em seguida.",
      );
      await load();
    } catch {
      setPluggyMessage("A conexão foi concluída, mas a sincronização falhou.");
    } finally {
      setPluggyBusy(false);
    }
  }

  async function syncPluggy() {
    setPluggyBusy(true);
    setPluggyMessage("");
    try {
      const response = await authFetch("/admin/finance/pluggy/sync", {
        method: "POST",
      });
      if (response.status === 401) {
        router.replace(ROUTER_LOGIN);
        return;
      }
      if (!response.ok) {
        setPluggyMessage("Não foi possível atualizar as contas agora.");
        return;
      }
      const result = await response.json();
      setPluggyMessage(
        result.pendingConnections
          ? "A instituição ainda está buscando os dados. Tente novamente em alguns instantes."
          : "Contas e lançamentos atualizados pela Pluggy.",
      );
      await load();
    } catch {
      setPluggyMessage("Não foi possível atualizar as contas agora.");
    } finally {
      setPluggyBusy(false);
    }
  }

  async function removePluggyConnection(connection) {
    if (!window.confirm(`Desconectar ${connection.institutionName}? O acesso bancário será revogado, mas os lançamentos já importados serão mantidos.`)) return;
    setPluggyBusy(true);
    setPluggyMessage("");
    try {
      const response = await authFetch(`/admin/finance/pluggy/connections/${connection.id}`, { method: "DELETE" });
      if (response.status === 401) {
        router.replace(ROUTER_LOGIN);
        return;
      }
      if (!response.ok) {
        setPluggyMessage("Não foi possível desconectar a instituição. Ela continua vinculada.");
        return;
      }
      setPluggyMessage(`${connection.institutionName} desconectada; os lançamentos importados foram mantidos.`);
      await load();
    } catch {
      setPluggyMessage("Não foi possível desconectar a instituição agora.");
    } finally {
      setPluggyBusy(false);
    }
  }

  return (
    <main className={styles.page}>
      <FinanceNavigation active="overview" />
      <div className={styles.pageTop}>
        <div>
          <p className={styles.kicker}>VISÃO GERAL</p>
          <h1>Finanças</h1>
          <p className={styles.subtitle}>
            Movimentações atualizadas automaticamente a cada hora via Open Finance.
          </p>
        </div>
        <div className={styles.topActions}>
          <MonthPicker month={month} onChange={setMonth} />
          <button
            className={styles.primaryButton}
            type="button"
            onClick={startPluggyConnect}
            disabled={pluggyBusy}
          >
            {pluggyBusy ? "Conectando…" : "+ Conectar banco"}
          </button>
          <Link
            className={styles.secondaryButton}
            href="/admin/finance/transactions?new=1"
          >
            Lançamento manual
          </Link>
        </div>
      </div>

      <section className={`${styles.panel} ${styles.pluggyPanel}`}>
        <div className={styles.panelHeading}>
          <div>
            <h2>Contas conectadas</h2>
            <p>Sincronização automática a cada hora; você também pode atualizar manualmente.</p>
          </div>
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={syncPluggy}
            disabled={pluggyBusy || connections.length === 0}
          >
            Atualizar agora
          </button>
        </div>
        {connections.length ? (
          <div className={styles.connectionList}>
            {connections.map((connection) => (
              <div className={styles.connectionRow} key={connection.id}>
                <strong>{connection.institutionName}</strong>
                <div className={styles.connectionActions}>
                  <span>
                    {connection.status === "UPDATED"
                      ? "Conectada"
                      : connection.status === "UPDATING"
                        ? "Sincronizando"
                        : "Aguardando atualização"}
                  </span>
                  <button
                    className={styles.connectionRemove}
                    type="button"
                    onClick={() => removePluggyConnection(connection)}
                    disabled={pluggyBusy}
                    aria-label={`Remover conexão com ${connection.institutionName}`}
                  >
                    Remover
                  </button>
                </div>
                <small>
                  {connection.lastSyncedAt
                    ? `Última sincronização: ${new Date(connection.lastSyncedAt).toLocaleString("pt-BR")}`
                    : "Aguardando a primeira sincronização"}
                </small>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            Nenhum banco conectado. Conecte uma instituição para importar seus
            lançamentos automaticamente.
          </div>
        )}
        {pluggySyncUnavailable && (
          <p className={styles.formMessage} role="status">
            {PLUGGY_STALE_OVERVIEW_MESSAGE}
          </p>
        )}
        {pluggyMessage && (
          <p className={styles.formMessage} role="status">
            {pluggyMessage}
          </p>
        )}
        {connectToken && (
          <PluggyConnect
            connectToken={connectToken}
            language="pt"
            theme="light"
            includeSandbox={false}
            products={["ACCOUNTS", "CREDIT_CARDS", "TRANSACTIONS"]}
            onSuccess={finishPluggyConnect}
            onError={() => {
              setConnectToken(null);
              setPluggyMessage("A Pluggy não conseguiu concluir a conexão.");
            }}
            onClose={() => setConnectToken(null)}
          />
        )}
      </section>
      {status === "loading" && (
        <div className={styles.loading}>Carregando seu resumo…</div>
      )}
      {status === "error" && (
        <div className={styles.error}>
          Não foi possível carregar as finanças.{" "}
          <button type="button" onClick={load}>
            Tentar novamente
          </button>
        </div>
      )}
      {status === "ready" && (
        <>
          <section className={styles.metricGrid} aria-label="Resumo do mês">
            <article className={styles.metricCard}>
              <span className={styles.metricIcon}>↘</span>
              <span className={styles.metricLabel}>Despesas do mês</span>
              <strong className={styles.expenseAmount}>{money(totals.expensesCents)}</strong>
              <Change
                current={totals.expensesCents}
                previous={totals.previousExpensesCents}
              />
            </article>
            <article className={styles.metricCard}>
              <span className={`${styles.metricIcon} ${styles.incomeIcon}`}>
                ↗
              </span>
              <span className={styles.metricLabel}>Receitas do mês</span>
              <strong className={styles.incomeAmount}>{money(totals.incomeCents)}</strong>
              <Change
                current={totals.incomeCents}
                previous={totals.previousIncomeCents}
                higherIsBetter
              />
            </article>
            <article className={styles.metricCard}>
              <span className={`${styles.metricIcon} ${styles.balanceIcon}`}>
                ＝
              </span>
              <span className={styles.metricLabel}>Saldo do período</span>
              <strong
                className={totals.balanceCents < 0 ? styles.negative : ""}
              >
                {money(totals.balanceCents)}
              </strong>
              <span className={styles.muted}>Receitas menos despesas</span>
            </article>
            <article className={`${styles.metricCard} ${styles.highlightCard}`}>
              <span className={styles.metricLabel}>Maior categoria</span>
              <strong>{topCategory?.name ?? "—"}</strong>
              <span>
                {topCategory
                  ? money(topCategory.amountCents)
                  : "Adicione seus lançamentos"}
              </span>
            </article>
          </section>
          <section className={styles.dashboardGrid}>
            <article className={styles.panel}>
              <div className={styles.panelHeading}>
                <div>
                  <h2>Despesas ao longo do mês</h2>
                  <p>Distribuição diária das saídas</p>
                </div>
                <span className={`${styles.panelTotal} ${styles.expenseAmount}`}>
                  {money(totals.expensesCents)}
                </span>
              </div>
              <LineChart values={data.daily} />
            </article>
            <article className={styles.panel}>
              <div className={styles.panelHeading}>
                <div>
                  <h2>Despesas por categoria</h2>
                  <p>Onde o dinheiro está indo</p>
                </div>
                <Link href="/admin/finance/transactions">Ver todas</Link>
              </div>
              {data.categories.length ? (
                <div className={styles.categoryBars}>
                  {data.categories.slice(0, 6).map((item) => (
                    <Link
                      className={styles.categoryRowLink}
                      key={item.id}
                      href={`/admin/finance/transactions?month=${month}&kind=expense&categoryId=${encodeURIComponent(item.id)}`}
                      aria-label={`Ver despesas de ${item.name}`}
                    >
                      <div className={styles.categoryRow}>
                        <div className={styles.categoryLabel}>
                          <span>
                            <i style={{ background: item.color }} />
                            {item.name}
                          </span>
                          <strong>{money(item.amountCents)}</strong>
                        </div>
                        <div className={styles.track}>
                          <span
                            style={{
                              width: `${Math.max(3, (item.amountCents / maxCategory) * 100)}%`,
                              background: item.color,
                            }}
                          />
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className={styles.emptyState}>
                  Suas categorias aparecerão aqui quando você registrar
                  despesas.
                </div>
              )}
            </article>
          </section>
          <section className={styles.panel}>
            <div className={styles.panelHeading}>
              <div>
                <h2>Lançamentos recentes</h2>
                <p>Atividade financeira de {monthLabel(month)}</p>
              </div>
              <Link href="/admin/finance/transactions">Ver lançamentos →</Link>
            </div>
            {data.recentTransactions.length ? (
              <div className={styles.transactionList}>
                {data.recentTransactions.map((item) => (
                  <div className={styles.transaction} key={item.id}>
                    <span
                      className={styles.txMark}
                      style={{ background: item.category?.color ?? "#dce8e3" }}
                    >
                      {item.kind === "income" ? "↗" : "↘"}
                    </span>
                    <span className={styles.txDescription}>
                      <strong>{item.description}</strong>
                      <small>
                        {item.source === "pluggy" ? "Open Finance" : "Manual"} ·{" "}
                        {item.category?.name ?? "Sem categoria"} ·{" "}
                        {dateLabel(item.occurredAt)}
                      </small>
                    </span>
                    <strong
                      className={
                        item.kind === "income" ? styles.incomeAmount : styles.expenseAmount
                      }
                    >
                      {item.kind === "income" ? "+" : "−"}
                      {money(item.amountCents)}
                    </strong>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.emptyState}>
                Ainda não há lançamentos neste mês.{" "}
                <Link href="/admin/finance/transactions?new=1">
                  Adicionar primeiro lançamento
                </Link>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}

const emptyForm = () => ({
  description: "",
  amount: "",
  kind: "expense",
  occurredAt: localDateString(),
  categoryId: "",
  accountName: "Conta principal",
});

export function FinanceTransactions() {
  const router = useRouter();
  const [month, setMonth] = useState(() => queryParam("month") ?? currentMonth());
  const [allTime, setAllTime] = useState(() => queryParam("period") === "all");
  const [kind, setKind] = useState(() => queryParam("kind") ?? "all");
  const [categoryId, setCategoryId] = useState(() => queryParam("categoryId") ?? "");
  const [search, setSearch] = useState("");
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [totalAmountCents, setTotalAmountCents] = useState(0);
  const [status, setStatus] = useState("loading");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [showCategory, setShowCategory] = useState(false);

  useEffect(() => {
    if (!editing) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setEditing(null);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [editing]);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const authenticated = await ensureSession();
      if (!authenticated) {
        router.replace(ROUTER_LOGIN);
        return;
      }
      const params = new URLSearchParams({
        month: allTime ? "all" : month,
        page: String(page),
        limit: "20",
      });
      if (kind !== "all") params.set("kind", kind);
      if (categoryId) params.set("categoryId", categoryId);
      if (search.trim()) params.set("search", search.trim());
      const [transactionResponse, categoryResponse] = await Promise.all([
        authFetch(`/admin/finance/transactions?${params}`),
        authFetch("/admin/finance/categories"),
      ]);
      if (
        transactionResponse.status === 401 ||
        categoryResponse.status === 401
      ) {
        router.replace(ROUTER_LOGIN);
        return;
      }
      if (!transactionResponse.ok || !categoryResponse.ok) {
        setStatus("error");
        return;
      }
      const [transactionData, categoryData] = await Promise.all([
        transactionResponse.json(),
        categoryResponse.json(),
      ]);
      setItems(transactionData.items);
      setPages(Math.max(1, transactionData.totalPages));
      setTotalAmountCents(
        kind === "income"
          ? transactionData.totalAmountCents ?? 0
          : transactionData.totalExpenseAmountCents ?? transactionData.totalAmountCents ?? 0,
      );
      setCategories(categoryData);
      if (transactionData.pluggySyncUnavailable) {
        setMessage(PLUGGY_STALE_TRANSACTIONS_MESSAGE);
      } else {
        setMessage((message) =>
          message === PLUGGY_STALE_TRANSACTIONS_MESSAGE ? "" : message,
        );
      }
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [month, allTime, page, kind, categoryId, search, router]);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("new") === "1"
    )
      setEditing("new");
  }, []);

  function beginEdit(item) {
    setForm(
      item
        ? {
            description: item.description,
            amount: (item.amountCents / 100).toFixed(2).replace(".", ","),
            kind: item.kind,
            occurredAt: new Date(item.occurredAt).toISOString().slice(0, 10),
            categoryId: item.categoryId ?? "",
            accountName: item.accountName ?? "Conta principal",
          }
        : emptyForm(),
    );
    setEditing(item ?? "new");
    setMessage("");
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const enteredAmount = form.amount.trim();
    const parsedAmount = Number(
      enteredAmount.includes(",")
        ? enteredAmount.replace(/\./g, "").replace(",", ".")
        : enteredAmount,
    );
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setMessage("Informe um valor maior que zero.");
      setSaving(false);
      return;
    }
    const body =
      editing !== "new" && editing.source === "pluggy"
        ? {
            description: form.description.trim(),
            amountCents: Math.round(parsedAmount * 100),
            categoryId: form.categoryId || null,
          }
        : {
            description: form.description.trim(),
            amountCents: Math.round(parsedAmount * 100),
            kind: form.kind,
            occurredAt: form.occurredAt,
            categoryId: form.categoryId || null,
            accountName: form.accountName.trim() || "Conta principal",
          };
    const response = await authFetch(
      editing === "new"
        ? "/admin/finance/transactions"
        : `/admin/finance/transactions/${editing.id}`,
      {
        method: editing === "new" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    if (response.ok) {
      setEditing(null);
      await load();
    } else
      setMessage(
        "Não foi possível salvar. Confira os dados e tente novamente.",
      );
    setSaving(false);
  }

  async function remove(item) {
    if (!window.confirm(`Excluir o lançamento “${item.description}”?`)) return;
    const response = await authFetch(`/admin/finance/transactions/${item.id}`, {
      method: "DELETE",
    });
    if (response.ok) await load();
    else setMessage("Não foi possível excluir esse lançamento.");
  }

  async function addCategory(event) {
    event.preventDefault();
    const response = await authFetch("/admin/finance/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCategory.trim() }),
    });
    if (response.ok) {
      setNewCategory("");
      setShowCategory(false);
      await load();
    } else setMessage("Não foi possível criar a categoria.");
  }

  return (
    <main className={styles.page}>
      <FinanceNavigation active="transactions" />
      <div className={styles.pageTop}>
        <div>
          <p className={styles.kicker}>MOVIMENTAÇÕES</p>
          <h1>Despesas e lançamentos</h1>
          <p className={styles.subtitle}>
            Organize entradas, saídas e categorias.
          </p>
        </div>
        <button
          className={styles.primaryButton}
          type="button"
          onClick={() => beginEdit(null)}
        >
          + Novo lançamento
        </button>
      </div>

      <section className={styles.panel}>
        <div className={styles.filters}>
          {allTime ? (
            <span className={styles.allPeriodLabel}>Todo o período</span>
          ) : (
            <MonthPicker
              month={month}
              onChange={(value) => {
                setPage(1);
                setMonth(value);
              }}
            />
          )}
          <button
            className={styles.periodToggle}
            type="button"
            onClick={() => {
              setPage(1);
              setAllTime((value) => !value);
            }}
          >
            {allTime ? "Filtrar por mês" : "Ver todo o período"}
          </button>
          <input
            aria-label="Buscar lançamento"
            type="search"
            placeholder="Buscar descrição…"
            value={search}
            onChange={(event) => {
              setPage(1);
              setSearch(event.target.value);
            }}
          />
          <select
            aria-label="Tipo"
            value={kind}
            onChange={(event) => {
              setPage(1);
              setKind(event.target.value);
            }}
          >
            <option value="all">Todos os tipos</option>
            <option value="expense">Despesas</option>
            <option value="income">Receitas</option>
          </select>
          <select
            aria-label="Categoria"
            value={categoryId}
            onChange={(event) => {
              setPage(1);
              setCategoryId(event.target.value);
            }}
          >
            <option value="">Todas as categorias</option>
            <option value="uncategorized">Sem categoria</option>
            {categories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={() => setShowCategory((value) => !value)}
          >
            Criar categoria rápida
          </button>
          <Link className={styles.secondaryButton} href="/admin/finance/categories">
            Gerenciador completo
          </Link>
        </div>
        {showCategory && (
          <form className={styles.categoryForm} onSubmit={addCategory}>
            <label htmlFor="new-category">Nova categoria</label>
            <input
              id="new-category"
              value={newCategory}
              onChange={(event) => setNewCategory(event.target.value)}
              maxLength={60}
              required
              placeholder="Ex.: Transporte"
            />
            <button className={styles.secondaryButton} type="submit">
              Adicionar
            </button>
          </form>
        )}
        {message && !editing && (
          <p className={styles.formMessage} role="alert">
            {message}
          </p>
        )}
        {status === "loading" && (
          <div className={styles.loading}>Carregando lançamentos…</div>
        )}
        {status === "error" && (
          <div className={styles.error}>
            Erro ao carregar lançamentos.{" "}
            <button type="button" onClick={load}>
              Tentar novamente
            </button>
          </div>
        )}
        {status === "ready" &&
          (items.length ? (
            <>
              {categoryId && (
                <section className={styles.categorySummary} aria-label="Resumo da categoria" role="region">
                  <div>
                    <span>{kind === "income" ? "Receitas em" : "Despesas em"}</span>
                    <strong>
                      {categories.find((item) => item.id === categoryId)?.name ??
                        (categoryId === "uncategorized" ? "Sem categoria" : "Categoria")}
                      {allTime ? " · Todo o período" : ` · ${monthLabel(month)}`}
                    </strong>
                    {categories.find((item) => item.id === categoryId)?.excludedFromTotals && (
                      <small>Esta categoria não entra nos totais gerais.</small>
                    )}
                  </div>
                  <strong
                    className={kind === "income" ? styles.incomeAmount : styles.expenseAmount}
                  >
                    {money(totalAmountCents)}
                  </strong>
                </section>
              )}
              <div className={styles.transactionTable}>
                <div className={styles.tableHeader}>
                  <span>Descrição</span>
                  <span>Categoria</span>
                  <span>Conta</span>
                  <span>Data</span>
                  <span>Valor</span>
                  <span>Ações</span>
                </div>
                {items.map((item) => (
                  <div className={styles.tableRow} key={item.id}>
                    <span className={styles.txDescription}>
                      <strong>{item.description}</strong>
                      <small>
                        {item.kind === "income" ? "Receita" : "Despesa"}
                        {item.source === "pluggy" ? " · Open Finance" : " · Manual"}
                      </small>
                    </span>
                    <span>
                      <i
                        className={styles.categoryDot}
                        style={{
                          background: item.category?.color ?? "#a3b7ad",
                        }}
                      />
                      {item.category?.name ?? "Sem categoria"}
                    </span>
                    <span>{item.accountName}</span>
                    <span>{dateLabel(item.occurredAt)}</span>
                    <strong
                      className={
                        item.kind === "income" ? styles.incomeAmount : styles.expenseAmount
                      }
                    >
                      {item.kind === "income" ? "+" : "−"}
                      {money(item.amountCents)}
                    </strong>
                    <span className={styles.rowActions}>
                      {item.source === "pluggy" ? (
                        <button
                          type="button"
                          onClick={() => beginEdit(item)}
                          aria-label={`Editar ${item.description}`}
                        >
                          Editar
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => beginEdit(item)}
                            aria-label={`Editar ${item.description}`}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => remove(item)}
                            aria-label={`Excluir ${item.description}`}
                          >
                            Excluir
                          </button>
                        </>
                      )}
                    </span>
                  </div>
                ))}
              </div>
              <div className={styles.pagination}>
                <span>
                  Página {page} de {pages}
                </span>
                <div>
                  <button
                    type="button"
                    onClick={() => setPage((value) => Math.max(1, value - 1))}
                    disabled={page <= 1}
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setPage((value) => Math.min(pages, value + 1))
                    }
                    disabled={page >= pages}
                  >
                    Próxima
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className={styles.emptyState}>
              Nenhum lançamento encontrado.{" "}
              <button type="button" onClick={() => beginEdit(null)}>
                Adicionar lançamento
              </button>
            </div>
          ))}
      </section>
      {editing && (
        <div
          className={styles.modalBackdrop}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setEditing(null);
          }}
        >
          <section
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="transaction-title"
          >
            <div className={styles.modalHeader}>
              <h2 id="transaction-title">
                {editing === "new" ? "Novo lançamento" : "Editar lançamento"}
              </h2>
              <button
                type="button"
                onClick={() => setEditing(null)}
                aria-label="Fechar"
              >
                ×
              </button>
            </div>
            <form onSubmit={submit} className={styles.transactionForm}>
              {!(editing !== "new" && editing.source === "pluggy") && (
                <label>
                  Tipo
                  <select
                    value={form.kind}
                    onChange={(event) => setForm({ ...form, kind: event.target.value })}
                  >
                    <option value="expense">Despesa</option>
                    <option value="income">Receita</option>
                  </select>
                </label>
              )}
              <label>
                Descrição
                <input
                  value={form.description}
                  onChange={(event) =>
                    setForm({ ...form, description: event.target.value })
                  }
                  required
                  maxLength={160}
                  autoFocus
                />
              </label>
              <div className={styles.formColumns}>
                <label>
                  Valor (R$)
                  <input
                    inputMode="decimal"
                    placeholder="0,00"
                    value={form.amount}
                    onChange={(event) =>
                      setForm({ ...form, amount: event.target.value })
                    }
                    required
                  />
                </label>
                {!(editing !== "new" && editing.source === "pluggy") && (
                  <label>
                    Data
                    <input
                      type="date"
                      value={form.occurredAt}
                      onChange={(event) => setForm({ ...form, occurredAt: event.target.value })}
                      required
                    />
                  </label>
                )}
              </div>
              <div className={styles.formColumns}>
                <label>
                  Categoria
                  <select
                    value={form.categoryId}
                    onChange={(event) =>
                      setForm({ ...form, categoryId: event.target.value })
                    }
                  >
                    <option value="">Sem categoria</option>
                    {categories.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                {!(editing !== "new" && editing.source === "pluggy") && (
                  <label>
                    Conta
                    <input
                      value={form.accountName}
                      onChange={(event) => setForm({ ...form, accountName: event.target.value })}
                      maxLength={100}
                    />
                  </label>
                )}
              </div>
              {message && (
                <p className={styles.formMessage} role="alert">
                  {message}
                </p>
              )}
              <div className={styles.modalActions}>
                <button
                  className={styles.secondaryButton}
                  type="button"
                  onClick={() => setEditing(null)}
                >
                  Cancelar
                </button>
                <button
                  className={styles.primaryButton}
                  type="submit"
                  disabled={saving}
                >
                  {saving ? "Salvando…" : "Salvar lançamento"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
