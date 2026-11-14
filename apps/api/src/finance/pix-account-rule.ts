type Rule = { accountName: string; kind: string; categoryId: string; ownTransfer: boolean };

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

export function findPixAccountRule<T extends Rule>(rules: T[], accountName: string, kind: string,
  transaction: { description?: string; operationType?: string | null; paymentData?: { paymentMethod?: string } }) {
  const isPix = /\bpix\b/i.test(transaction.description ?? "") ||
    transaction.paymentData?.paymentMethod?.toUpperCase() === "PIX" ||
    /\bPIX\b/.test((transaction.operationType ?? "").replace(/_/g, " ").toUpperCase());
  if (!isPix) return null;
  return rules.find((rule) => normalize(rule.accountName) === normalize(accountName) && rule.kind === kind) ?? null;
}
