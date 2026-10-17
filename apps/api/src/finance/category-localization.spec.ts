import { translateCategoryName } from "./category-localization";

describe("translateCategoryName", () => {
  it.each([
    ["Food & Drink", "Alimentação"],
    ["Transportation", "Transporte"],
    ["Shopping", "Compras"],
    ["Bills and Utilities", "Contas e serviços"],
    ["Education", "Educação"],
    ["Compras", "Compras"],
  ])("localizes %s as %s", (source, expected) => {
    expect(translateCategoryName(source)).toBe(expected);
  });

  it("uses a Portuguese fallback for an unmapped foreign label", () => {
    expect(translateCategoryName("Peer-to-peer fees")).toBe("Outros");
  });
});
