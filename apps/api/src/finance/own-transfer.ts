const OWNER_NAME = "vitor hugo de souza sierro";

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

type Payment = {
  description?: string | null;
  type?: string;
  operationType?: string | null;
  paymentData?: {
    paymentMethod?: string;
    payer?: { name?: string };
    receiver?: { name?: string };
  };
};

export function isOwnPix(transaction: Payment): boolean {
  const description = normalize(transaction.description ?? "");
  const method = normalize(transaction.paymentData?.paymentMethod ?? "");
  const operation = normalize(transaction.operationType ?? "");
  if (![description, method, operation].some((value) => /\bpix\b/.test(value))) {
    return false;
  }
  // Only inspect the counterparty: the account owner's name on the other side
  // of an ordinary payment must not make a third-party Pix disappear.
  const counterparty = transaction.type === "CREDIT"
    ? transaction.paymentData?.payer?.name
    : transaction.type === "DEBIT"
      ? transaction.paymentData?.receiver?.name
      : undefined;
  if (counterparty?.trim()) return normalize(counterparty) === OWNER_NAME;
  // Older imports only retained the description. Require the entire name.
  return ` ${description} `.includes(` ${OWNER_NAME} `);
}
