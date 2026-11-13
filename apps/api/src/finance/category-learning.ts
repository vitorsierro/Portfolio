type Rule = { merchantKey: string; kind: string; amountCents: number; categoryId: string };

export function categoryRuleKey(description: string, kind: string, amountCents: number) {
  let key = description.replace(/\s+\d+\s*\/\s*\d+\s*$/, "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  // Preserve the full counterparty, not just 'Pix' or 'transferência'.
  const constrained = /\bpix\b|\btransferencia\b|mercadolivre|mercado livre|shopee|amazonmktplc|amazon retail|\bamazon\b|\btemu\b|pagseguro|pagaleve|eb anx|ebanx|pay2all|pushinpay|sync pay|demerge|pagamento efetuado/.test(key);
  if (/^(pagamento (de )?pix|pix enviado( pix enviado)?|pix recebido( pix recebido)?|transferencia recebida|compra no cartao|compra|mercado)$/.test(key)) return null;
  if (!constrained) {
    if (/\buber\b|^99\b|^pop\b/.test(key)) key = /^99\b/.test(key) ? "99 transporte" : /^pop\b/.test(key) ? "pop transporte" : "uber transporte";
    else if (/\bopenai\b|\bchatgpt\b/.test(key)) key = "openai chatgpt";
    else if (/\banthropic\b|\bclaude\b/.test(key)) key = "anthropic claude";
    else if (/\bhostinger/.test(key)) key = "hostinger hospedagem";
    else if (/\bnetflix\b/.test(key)) key = "netflix streaming";
    else if (/^apple( com bill|combill)/.test(key)) key = "apple com bill";
    else if (/\bgoogle youtube member\b|^dl google youtub$/.test(key)) key = "youtube member";
  }
  if (key.length < 4) return null;
  return { merchantKey: key, kind, amountCents: constrained ? amountCents : -1 };
}

export function findLearnedCategory(rules: Rule[], description: string, kind: string, amountCents: number): string | null {
  const key = categoryRuleKey(description, kind, amountCents);
  if (!key) return null;
  const candidates = rules.filter((rule) => rule.kind === kind &&
    (rule.amountCents === -1 || rule.amountCents === amountCents));
  const exact = candidates.find((rule) => rule.merchantKey === key.merchantKey);
  if (exact) return exact.categoryId;
  // For unconstrained merchants, tolerate formatting changes or an extra
  // descriptive token only with strong token overlap. Personal Pix and
  // marketplaces always require the exact name AND the same amount.
  if (key.amountCents !== -1) return null;
  const words = new Set(key.merchantKey.split(" "));
  const matches = candidates.filter((rule) => rule.amountCents === -1).map((rule) => {
    const other = new Set(rule.merchantKey.split(" "));
    const shared = [...words].filter((word) => other.has(word)).length;
    return { rule, score: shared >= 3 ? 2 * shared / (words.size + other.size) : 0 };
  }).filter((match) => match.score >= 0.9).sort((a, b) => b.score - a.score);
  // Conflicting equally good examples are deliberately left for review.
  if (!matches.length || (matches[1]?.score === matches[0].score &&
    matches[1].rule.categoryId !== matches[0].rule.categoryId)) return null;
  return matches[0].rule.categoryId;
}
