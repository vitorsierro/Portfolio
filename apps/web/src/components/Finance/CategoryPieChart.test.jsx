import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { CategoryPieChart } from "./CategoryPieChart";

beforeEach(() => localStorage.clear());

test("hides categories, recalculates shares and restores the saved selection", () => {
  const categories = [
    { id: "home", name: "Moradia", totals: [{ amountCents: 30000 }] },
    { id: "food", name: "Alimentação", totals: [{ amountCents: 10000 }] },
  ];
  const view = render(<CategoryPieChart categories={categories} />);
  fireEvent.click(screen.getByText(/Categorias no gráfico/));
  fireEvent.click(screen.getByRole("checkbox", { name: "Moradia" }));
  expect(screen.getByRole("img", { name: /Total: R\$\s*100,00/ })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Alimentação.*100%/ })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Moradia.*300/ })).not.toBeInTheDocument();
  view.unmount();
  render(<CategoryPieChart categories={categories} />);
  expect(screen.getByRole("img", { name: /Total: R\$\s*100,00/ })).toBeInTheDocument();
  fireEvent.click(screen.getByText(/Categorias no gráfico/));
  fireEvent.click(screen.getByRole("checkbox", { name: "Alimentação" }));
  expect(screen.getByText(/Todas as categorias estão ocultas/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Mostrar todas" }));
  expect(screen.getByRole("img", { name: /Total: R\$\s*400,00/ })).toBeInTheDocument();
});

test("distributes expenses proportionally without net investments or excluded categories", () => {
  render(<CategoryPieChart categories={[
    { id: "home", name: "Moradia", totals: [{ amountCents: 30000 }] },
    { id: "food", name: "Alimentação", totals: [{ amountCents: 10000 }] },
    { id: "investment", name: "Investimentos", calculation: "net-investment-flow", totals: [{ amountCents: -20000 }] },
    { id: "excluded", name: "Clínica — Pai", excludedFromTotals: true, totals: [{ amountCents: 170000 }] },
  ]} />);
  expect(screen.getByRole("img", { name: /Total: R\$\s*400,00/ })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Moradia.*300,00.*75%/ })).toBeInTheDocument();
  const food = screen.getByRole("button", { name: /Alimentação.*100,00.*25%/ });
  fireEvent.click(food);
  expect(food).toHaveAttribute("aria-pressed", "true");
  expect(screen.queryByRole("button", { name: /Investimentos/ })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Clínica/ })).not.toBeInTheDocument();
});

test("renders a complete circle for a single category and an empty state without expenses", () => {
  const { container, rerender } = render(<CategoryPieChart categories={[{ id: "one", name: "Moradia", totals: [{ amountCents: 1000 }] }]} />);
  expect(container.querySelector("path")).toHaveAttribute("d", "M 120 16 A 104 104 0 1 1 120 224 A 104 104 0 1 1 120 16 Z");
  expect(screen.getByRole("button", { name: /100%/ })).toBeInTheDocument();
  rerender(<CategoryPieChart categories={[]} />);
  expect(screen.getByText(/Sem gastos para distribuir/)).toBeInTheDocument();
});
