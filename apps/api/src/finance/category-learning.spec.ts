import { categoryRuleKey, findLearnedCategory } from "./category-learning";

describe("aprendizado de categorias por estabelecimento", () => {
  it("remove parcelas e normaliza caixa e pontuação", () => {
    expect(categoryRuleKey("Dm*Hostingercomb 4/12", "expense", 10718))
      .toEqual(categoryRuleKey("DM*HOSTINGERCOMB 5/12", "expense", 10721));
  });
  it("aproxima variações conhecidas sem confundir categorias de transporte", () => {
    const key = categoryRuleKey("Uber* Trip", "expense", 2500)!;
    expect(findLearnedCategory([{ ...key, categoryId: "transport" }], "Uber Uber *Trip Help.U", "expense", 3500)).toBe("transport");
    expect(findLearnedCategory([{ ...key, categoryId: "transport" }], "iFood", "expense", 2500)).toBeNull();
  });
  it("reconhece um sufixo adicional com alta similaridade", () => {
    const rule = { ...categoryRuleKey("Loja de materiais para construcao central", "expense", 1000)!, categoryId: "home" };
    expect(findLearnedCategory([rule], "Loja de materiais para construcao central LTDA", "expense", 2000)).toBe("home");
  });
  it("não generaliza Pix pessoais por outro nome ou valor", () => {
    const rule = { ...categoryRuleKey("Pix Luciana Sousa dos Santos Vilhanueva", "expense", 120000)!, categoryId: "mortgage" };
    expect(findLearnedCategory([rule], "Pix Luciana Sousa dos Santos Vilhanueva", "expense", 120000)).toBe("mortgage");
    expect(findLearnedCategory([rule], "Pix Luciana Sousa dos Santos Vilhanueva", "expense", 240000)).toBeNull();
    expect(findLearnedCategory([rule], "Pix Luciana Sousa dos Santos", "expense", 120000)).toBeNull();
    expect(findLearnedCategory([rule], "Pix Luciana Sousa dos Santos Vilhanueva", "income", 120000)).toBeNull();
  });
  it("restringe marketplace ao valor e evita descrições genéricas de Pix", () => {
    expect(categoryRuleKey("Mercadolivre*Loja", "expense", 10000)?.amountCents).toBe(10000);
    expect(categoryRuleKey("Pagamento de pix", "expense", 10000)).toBeNull();
  });
  it("não escolhe entre exemplos semelhantes com categorias conflitantes", () => {
    const rules = [
      { merchantKey: "loja de materiais para construcao central ltda", kind: "expense", amountCents: -1, categoryId: "a" },
      { merchantKey: "loja de materiais para construcao central sa", kind: "expense", amountCents: -1, categoryId: "b" },
    ];
    expect(findLearnedCategory(rules, "Loja de materiais para construcao central", "expense", 1000)).toBeNull();
  });
});
