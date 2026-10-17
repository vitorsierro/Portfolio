const CATEGORY_TRANSLATIONS: Record<string, string> = {
  "food and drink": "Alimentação",
  food: "Alimentação",
  dining: "Alimentação",
  restaurant: "Alimentação",
  restaurants: "Alimentação",
  groceries: "Mercado",
  grocery: "Mercado",
  supermarket: "Mercado",
  transportation: "Transporte",
  transport: "Transporte",
  commute: "Transporte",
  fuel: "Transporte",
  gas: "Transporte",
  shopping: "Compras",
  purchases: "Compras",
  "bills and utilities": "Contas e serviços",
  utilities: "Contas e serviços",
  bills: "Contas e serviços",
  housing: "Moradia",
  rent: "Moradia",
  health: "Saúde",
  healthcare: "Saúde",
  medical: "Saúde",
  education: "Educação",
  entertainment: "Lazer",
  leisure: "Lazer",
  travel: "Viagens",
  financial: "Serviços financeiros",
  "financial services": "Serviços financeiros",
  fees: "Tarifas e taxas",
  salary: "Salário",
  payroll: "Salário",
  income: "Renda",
  insurance: "Seguros",
  taxes: "Impostos",
  subscriptions: "Assinaturas",
  investments: "Investimentos",
  investment: "Investimentos",
  transfers: "Transferências",
  transfer: "Transferências",
  "cash withdrawal": "Saques",
  "cash withdrawals": "Saques",
  "personal care": "Cuidados pessoais",
  pets: "Pets",
  donations: "Doações",
  "fixed income": "Renda fixa",
  stocks: "Ações",
  equities: "Ações",
  "real estate funds": "Fundos imobiliários",
  "real estate investment trusts": "Fundos imobiliários",
  funds: "Fundos",
  "mutual funds": "Fundos",
  "government bonds": "Tesouro Direto",
  "treasury bonds": "Tesouro Direto",
  crypto: "Criptomoedas",
  cryptocurrency: "Criptomoedas",
  cryptocurrencies: "Criptomoedas",
  retirement: "Previdência",
  "pension plans": "Previdência",
  other: "Outros",
  others: "Outros",
  alimentacao: "Alimentação",
  transporte: "Transporte",
  compras: "Compras",
  "contas e servicos": "Contas e serviços",
  moradia: "Moradia",
  saude: "Saúde",
  educacao: "Educação",
  lazer: "Lazer",
  viagens: "Viagens",
  "servicos financeiros": "Serviços financeiros",
  salario: "Salário",
  renda: "Renda",
  seguros: "Seguros",
  impostos: "Impostos",
  assinaturas: "Assinaturas",
  investimentos: "Investimentos",
  transferencias: "Transferências",
  saques: "Saques",
  "cuidados pessoais": "Cuidados pessoais",
  "renda fixa": "Renda fixa",
  acoes: "Ações",
  "fundos imobiliarios": "Fundos imobiliários",
  fundos: "Fundos",
  "tesouro direto": "Tesouro Direto",
  criptomoedas: "Criptomoedas",
  previdencia: "Previdência",
  doacoes: "Doações",
  outros: "Outros",
};

const PORTUGUESE_LABELS = new Set([
  "alimentacao",
  "mercado",
  "transporte",
  "compras",
  "contas e servicos",
  "moradia",
  "saude",
  "educacao",
  "lazer",
  "viagens",
  "servicos",
  "servicos financeiros",
  "tarifas e taxas",
  "salario",
  "renda",
  "seguros",
  "impostos",
  "assinaturas",
  "investimentos",
  "renda fixa",
  "acoes",
  "fundos imobiliarios",
  "fundos",
  "tesouro direto",
  "criptomoedas",
  "previdencia",
  "transferencias",
  "saques",
  "cuidados pessoais",
  "pets",
  "doacoes",
  "casa",
  "outros",
]);

function normalizeCategory(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/&/g, " and ")
    .replace(/[_-]+/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function translateCategoryName(value?: string | null): string {
  const label = value?.trim();
  if (!label) return "Outros";
  const normalized = normalizeCategory(label);
  const knownTranslation = CATEGORY_TRANSLATIONS[normalized];
  if (knownTranslation) return knownTranslation;
  if (
    PORTUGUESE_LABELS.has(normalized) ||
    /[áàâãéêíóôõúç]/i.test(label)
  ) {
    return label;
  }
  return "Outros";
}
