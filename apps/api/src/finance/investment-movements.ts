function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function cashMovementCategory(description: string, kind: string): string | null {
  const text = normalize(description);
  // A company can have 'Investimentos' in its name; payroll is still salary.
  if (kind === "income" && /^(salario\b|entrada pagto salario\b|remuneracao salario\b)/.test(text)) return "Salário";
  if (kind === "expense" && /^(aplicacao\b|compra de (renda variavel|acoes|cotas|fundos)\b)/.test(text)) return "Investimentos";
  if (kind === "income" && /^(resgate (rdb|fundo|res aplic|de investimentos)\b|dinheiro resgatado de saldo de investimentos\b|valor recebido de investimentos\b|entrada res aplic\b|venda de (renda variavel|acoes|cotas|fundos)\b)/.test(text)) return "Investimentos";
  return null;
}
