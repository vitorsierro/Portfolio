import { findPixAccountRule } from "./pix-account-rule";

describe("regra de Pix por conta", () => {
  const rules = [{ accountName: "itau", kind: "income", categoryId: "salary", ownTransfer: true }];
  it("reconhece a conta com acento e ignora o valor", () => {
    expect(findPixAccountRule(rules, "Itaú", "income", { description: "Pix recebido Pix recebido" })?.categoryId).toBe("salary");
  });
  it("não afeta outra conta, direção ou transações sem Pix", () => {
    expect(findPixAccountRule(rules, "Nubank", "income", { description: "Pix recebido" })).toBeNull();
    expect(findPixAccountRule(rules, "Itaú", "expense", { description: "Pix enviado" })).toBeNull();
    expect(findPixAccountRule(rules, "Itaú", "income", { description: "Salário" })).toBeNull();
  });
});
