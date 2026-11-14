import { cashMovementCategory } from "./investment-movements";
import { inferFinanceCategory } from "./category-rules";

describe("movimentos de investimento", () => {
  it.each([
    ["Aplicação RDB", "expense", "Investimentos"],
    ["Compra de Renda Variável", "expense", "Investimentos"],
    ["Venda de ações", "income", "Investimentos"],
    ["Resgate RDB", "income", "Investimentos"],
    ["Resgate RES APLIC AUT MAIS", "income", "Investimentos"],
    ["Entrada RES APLIC AUT MAIS AP", "income", "Investimentos"],
    ["Valor recebido de Investimentos", "income", "Investimentos"],
    ["Dinheiro resgatado de Saldo de Investimentos", "income", "Investimentos"],
    ["Resgate Fundo", "income", "Investimentos"],
    ["Resgate de Cashback", "income", null],
    ["Salário SMR PARTICIPACOES E INVESTIMENTOS SA", "income", "Salário"],
  ])("classifica %s", (description, kind, expected) => {
    expect(cashMovementCategory(description, kind)).toBe(expected);
    if (expected) expect(inferFinanceCategory({ description, kind, amountCents: 1000 })).toBe(expected);
  });
});
