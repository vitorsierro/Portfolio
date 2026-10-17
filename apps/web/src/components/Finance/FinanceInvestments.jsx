"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authFetch, ensureSession } from "../../lib/auth";
import { ROUTER_LOGIN } from "../../constants";
import styles from "../../styles/Finance.module.css";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const money = (cents = 0) => currency.format(cents / 100);
const today = () => {
  const date = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};
const emptyForm = () => ({ name: "", amount: "", category: "", acquiredAt: today() });

function centsFromInput(value) {
  const normalized = value.trim().includes(",")
    ? value.trim().replace(/\./g, "").replace(",", ".")
    : value.trim();
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) : 0;
}

export function FinanceInvestments() {
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [totalAmountCents, setTotalAmountCents] = useState(0);
  const [status, setStatus] = useState("loading");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      if (!(await ensureSession())) {
        router.replace(ROUTER_LOGIN);
        return;
      }
      const response = await authFetch("/admin/finance/investments");
      if (response.status === 401) {
        router.replace(ROUTER_LOGIN);
        return;
      }
      if (!response.ok) throw new Error("Falha ao carregar investimentos");
      const data = await response.json();
      setItems(data.items ?? []);
      setTotalAmountCents(data.totalAmountCents ?? 0);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  function beginEdit(item = null) {
    setForm(item ? {
      name: item.name,
      amount: (item.amountCents / 100).toFixed(2).replace(".", ","),
      category: item.category,
      acquiredAt: new Date(item.acquiredAt).toISOString().slice(0, 10),
    } : emptyForm());
    setEditing(item ?? "new");
    setMessage("");
  }

  async function submit(event) {
    event.preventDefault();
    const amountCents = centsFromInput(form.amount);
    if (!amountCents) {
      setMessage("Informe um valor maior que zero.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const response = await authFetch(
        editing === "new" ? "/admin/finance/investments" : `/admin/finance/investments/${editing.id}`,
        {
          method: editing === "new" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name.trim(), amountCents, category: form.category.trim(), acquiredAt: form.acquiredAt,
          }),
        },
      );
      if (response.status === 401) {
        router.replace(ROUTER_LOGIN);
        return;
      }
      if (!response.ok) throw new Error("Falha ao salvar investimento");
      setEditing(null);
      await load();
    } catch {
      setMessage("Não foi possível salvar o investimento. Confira os dados e tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(item) {
    if (!window.confirm(`Excluir o investimento “${item.name}”?`)) return;
    try {
      const response = await authFetch(`/admin/finance/investments/${item.id}`, { method: "DELETE" });
      if (response.status === 401) {
        router.replace(ROUTER_LOGIN);
        return;
      }
      if (!response.ok) throw new Error("Falha ao excluir investimento");
      await load();
    } catch {
      setMessage("Não foi possível excluir esse investimento.");
    }
  }

  return (
    <main className={styles.page}>
      <nav className={styles.financeNav} aria-label="Seções de finanças">
        <Link href="/admin/finance">Visão geral</Link>
        <Link href="/admin/finance/transactions">Movimentações</Link>
        <Link className={styles.navActive} href="/admin/finance/investments">Investimentos</Link>
      </nav>
      <div className={styles.pageTop}>
        <div>
          <p className={styles.kicker}>PATRIMÔNIO</p>
          <h1>Investimentos</h1>
          <p className={styles.subtitle}>Registre e acompanhe seus investimentos.</p>
        </div>
        <button className={styles.primaryButton} type="button" onClick={() => beginEdit()}>+ Novo investimento</button>
      </div>
      <section className={styles.panel}>
        <div className={styles.investmentTotal}>
          <span>Total investido</span>
          <strong>{money(totalAmountCents)}</strong>
        </div>
        {message && !editing && <p className={styles.formMessage} role="alert">{message}</p>}
        {status === "loading" && <div className={styles.loading}>Carregando investimentos…</div>}
        {status === "error" && <div className={styles.error}>Erro ao carregar investimentos. <button type="button" onClick={load}>Tentar novamente</button></div>}
        {status === "ready" && (items.length ? (
          <div className={styles.investmentList}>
            {items.map((item) => (
              <article className={styles.investmentRow} key={item.id}>
                <div><strong>{item.name}</strong><small>{item.category} · {new Date(item.acquiredAt).toLocaleDateString("pt-BR")}</small></div>
                <strong>{money(item.amountCents)}</strong>
                <span className={styles.rowActions}>
                  <button type="button" aria-label={`Editar ${item.name}`} onClick={() => beginEdit(item)}>Editar</button>
                  <button type="button" aria-label={`Excluir ${item.name}`} onClick={() => remove(item)}>Excluir</button>
                </span>
              </article>
            ))}
          </div>
        ) : <div className={styles.emptyState}>Nenhum investimento registrado. <button type="button" onClick={() => beginEdit()}>Adicionar investimento</button></div>)}
      </section>
      {editing && (
        <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditing(null); }}>
          <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="investment-title">
            <div className={styles.modalHeader}><h2 id="investment-title">{editing === "new" ? "Novo investimento" : "Editar investimento"}</h2><button type="button" aria-label="Fechar" onClick={() => setEditing(null)}>×</button></div>
            <form className={styles.transactionForm} onSubmit={submit}>
              <label>Nome do investimento<input aria-label="Nome do investimento" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} maxLength={100} required /></label>
              <label>Valor (R$)<input aria-label="Valor (R$)" inputMode="decimal" placeholder="0,00" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} required /></label>
              <label>Categoria do investimento<input aria-label="Categoria do investimento" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} maxLength={60} required /></label>
              <label>Data de aquisição<input type="date" value={form.acquiredAt} onChange={(event) => setForm({ ...form, acquiredAt: event.target.value })} required /></label>
              {message && <p className={styles.formMessage} role="alert">{message}</p>}
              <div className={styles.modalActions}><button className={styles.secondaryButton} type="button" onClick={() => setEditing(null)}>Cancelar</button><button className={styles.primaryButton} type="submit" disabled={saving}>{saving ? "Salvando…" : "Salvar investimento"}</button></div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
