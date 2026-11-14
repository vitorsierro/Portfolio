import { canonicalFinanceCategory } from "./category-consolidation";
import { inferFinanceCategory } from "./category-rules";
import { translateCategoryName } from "./category-localization";

describe("consolidação das categorias", () => {
  it.each([
    ["Compras — Suplementos", "Compras — Supermercado"],
    ["Compras — Farmácia e saúde", "Compras — Supermercado"],
    ["Transporte — Ônibus e metrô", "Transporte"],
    ["Transporte — Aplicativos", "Transporte"],
    ["Transporte — Manutenção", "Transporte"],
    ["Saúde — Ótica", "Saúde"],
    ["Saúde — Odontologia", "Saúde"],
    ["Assinaturas — Delivery", "Assinaturas"],
    ["Assinaturas — Idiomas", "Assinaturas"],
    ["Assinaturas — Hospedagem e domínios", "Assinaturas — Software, hospedagem e IA"],
    ["Assinaturas — IA e software", "Assinaturas — Software, hospedagem e IA"],
    ["Mercado", "Compras — Supermercado"],
    ["Fundos", "Investimentos"],
    ["Compras", "Compras — Outros"],
    ["Moradia", "Outros"],
    ["Contas e serviços", "Outros"],
    ["Cartões", "Outros"],
  ])("redireciona %s sem recriar categorias antigas", (source, target) => {
    expect(canonicalFinanceCategory(source)).toBe(target);
    expect(canonicalFinanceCategory(target)).toBe(target);
  });

  it("mantém finalidades específicas e tipos de ativos manuais", () => {
    expect(canonicalFinanceCategory("Moradia — Financiamento")).toBe("Moradia — Financiamento");
    expect(canonicalFinanceCategory("Cartões — Pagamento de fatura")).toBe("Cartões — Pagamento de fatura");
    expect(translateCategoryName("Fundos")).toBe("Fundos");
  });

  it("usa os novos destinos nas próximas importações", () => {
    expect(inferFinanceCategory({ description: "Maxtitanium", kind: "expense", amountCents: 1000 })).toBe("Compras — Supermercado");
    expect(inferFinanceCategory({ description: "Drogaria Sao Paulo", kind: "expense", amountCents: 1000 })).toBe("Compras — Supermercado");
    expect(inferFinanceCategory({ description: "Netflix", kind: "expense", amountCents: 1000 })).toBe("Assinaturas — Streaming e conteúdo");
  });
});
