import { inferFinanceCategory } from "./category-rules";
import { translateCategoryName } from "./category-localization";

describe("categorias pessoais", () => {
  it.each([
    ["Pagamento efetuado|BANCO IBI S A", 20000, "Transfers", "Cartões — Pagamento de fatura"],
    ["Pix enviado Luciana Sousa dos Santos Vilhanueva", 120000, null, "Moradia — Financiamento"],
    ["Pix enviado Luciana Sousa dos Santos Vilhanueva", 240000, null, null],
    ["Pix enviado Outra Luciana", 120000, null, null],
    ["Transferência enviada pelo Pix|CLAUDIA REGINA DE OLIVEIRA", 15000, "Transfers", "Moradia — Geral"],
    ["Pagamento efetuado|PM GUARUJA", 28399, "Transfers", "Moradia — Geral"],
    ["Pagamento efetuado|PREF MUN GUARUJA", 28399, "Housing", "Moradia — Geral"],
    ["COND EDIF RESID ITAPARICA III", 62626, "Housing", "Moradia — Geral"],
    ["Débito automático DA ELEKTRO 00001074", 24509, "Utilities", "Moradia — Eletricidade"],
    ["Pix TELEFONICA BRASIL S.A.", 4000, "Telecommunications", "Outros"],
    ["Dm*Hostingercomb 4/12", 10718, "School", "Assinaturas — Software, hospedagem e IA"],
    ["Openai *Chatgpt Subscr", 10340, "Digital services", "Assinaturas — Software, hospedagem e IA"],
    ["Anthropic* Claude Sub", 11416, "Digital services", "Assinaturas — Software, hospedagem e IA"],
    ["Netflix.Com", 4490, "Digital services", "Assinaturas — Streaming e conteúdo"],
    ["Google Youtube Member", 799, "Internet", "Assinaturas — Streaming e conteúdo"],
    ["MP*MELIMAIS", 1990, "Shopping", "Assinaturas — Streaming e conteúdo"],
    ["Totalpass", 8990, "Wellness and fitness", "Assinaturas — Academia e bem-estar"],
    ["MERCADOLIVRE*MERCADOLIVRE", 25938, "Electronics", "Compras — Eletrônicos"],
    ["MERCADOLIVRE*MERCADOLIVRE", 6999, "Telecommunications", "Compras — Outros"],
    ["MERCADOLIVRE*MERCADOLIVRE", 10843, "Houseware", "Compras — Casa e utilidades"],
    ["MINI EXTRA", 18000, "Groceries", "Compras — Supermercado"],
    ["SHOPEE *Maniadeenxoval", 10000, "Houseware", "Compras — Casa e utilidades"],
    ["iFood", 5000, "Food delivery", "Alimentação — Delivery"],
    ["Uber* Trip", 2500, "Taxi and ride-hailing", "Transporte"],
    ["Pagamento de fatura", 100000, "Credit card payment", "Cartões — Pagamento de fatura"],
    ["Pix para desconhecido", 5000, "Transfers", null],
  ])("classifica %s com valor %s", (description, amountCents, category, expected) => {
    const result = inferFinanceCategory({ description, amountCents, category, kind: "expense" });
    expect(result).toBe(expected);
    if (result) expect(translateCategoryName(result)).toBe(result);
  });

  it("não trata estornos ou entradas como gastos de assinatura", () => {
    expect(inferFinanceCategory({ description: "IOF de volta de Openai *Chatgpt Subscr", amountCents: 362, kind: "income" })).toBeNull();
  });
});
