import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { FinanceCategories } from "./FinanceCategories";
import { authFetch, ensureSession } from "../../lib/auth";

jest.mock("../../lib/auth", () => ({ authFetch: jest.fn(), ensureSession: jest.fn() }));
const mockRouter = { replace: jest.fn() };
jest.mock("next/navigation", () => ({ useRouter: () => mockRouter }));

const categoryData = [
  { id: "housing", name: "Moradia", color: "#176244", excludedFromTotals: false },
  { id: "trash", name: "Lixo", color: "#555555", excludedFromTotals: true },
];
const summaryData = {
  years: [2022, 2023, 2024, 2025, 2026],
  categories: [
    {
      id: "housing",
      name: "Moradia",
      color: "#176244",
      totals: [
        { year: 2022, amountCents: 10000 },
        { year: 2023, amountCents: 15000 },
        { year: 2024, amountCents: 20000 },
        { year: 2025, amountCents: 25000 },
        { year: 2026, amountCents: 30000 },
      ],
    },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  ensureSession.mockResolvedValue(true);
  authFetch.mockImplementation(async (url) => ({
    status: 200,
    ok: true,
    json: async () => url.includes("annual-summary") ? summaryData : categoryData,
  }));
});

test("shows annual category spending and links to all transactions for a category", async () => {
  render(<FinanceCategories />);

  expect(await screen.findByRole("img", { name: /Gastos por categoria/ })).toBeInTheDocument();
  expect(screen.getAllByText("Moradia").length).toBeGreaterThan(0);
  expect(screen.getByText("Lixo")).toBeInTheDocument();
  expect(screen.getByText("Excluída dos totais e gráficos gerais")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Ver todos os lançamentos de Moradia" })).toHaveAttribute(
    "href",
    "/admin/finance/transactions?categoryId=housing&period=all",
  );
  expect(screen.getAllByText(/R\$\s*1\.000,00/).length).toBeGreaterThan(0);
});

test("refreshes the annual comparison when its year range changes", async () => {
  render(<FinanceCategories />);
  await screen.findByRole("img", { name: /Gastos por categoria/ });
  fireEvent.change(screen.getByLabelText("Ano inicial"), { target: { value: "2024" } });

  await waitFor(() =>
    expect(authFetch).toHaveBeenCalledWith(
      expect.stringMatching(/annual-summary\?fromYear=2024/),
    ),
  );
});

test("shows negative net investment flow with a visible bar and explanation", async () => {
  authFetch.mockImplementation(async (url) => ({ status: 200, ok: true,
    json: async () => url.includes("annual-summary") ? { years: [2025], categories: [{
      id: "invest", name: "Investimentos", color: "#16a34a", calculation: "net-investment-flow",
      totals: [{ year: 2025, amountCents: -5000, applicationsCents: 10000, withdrawalsCents: 15000 }],
    }] } : categoryData,
  }));
  render(<FinanceCategories />);
  expect(await screen.findByText(/Aplicações menos resgates e vendas/)).toBeInTheDocument();
  expect(screen.getAllByText(/-R\$\s*50,00/).length).toBeGreaterThan(0);
  expect(screen.getByTitle(/aplicações R\$\s*100,00, resgates e vendas R\$\s*150,00/)).toHaveStyle({ width: "100%" });
});

test("puts category creation first and hides years without transactions", async () => {
  authFetch.mockImplementation(async (url) => ({ status: 200, ok: true,
    json: async () => url.includes("annual-summary") ? { availableYears: [2025, 2026], years: [2025, 2026], categories: [{
      ...summaryData.categories[0], totals: [{ year: 2025, amountCents: 10000 }, { year: 2026, amountCents: 30000 }],
    }] } : categoryData,
  }));
  render(<FinanceCategories />);
  await screen.findByRole("img", { name: /Gastos por categoria/ });
  expect(screen.getAllByRole("heading", { level: 2 })[0]).toHaveTextContent("Nova categoria");
  expect(screen.getByLabelText("Ano inicial")).toHaveValue("2025");
  expect(screen.queryByRole("option", { name: "2022" })).not.toBeInTheDocument();
  expect(screen.queryByRole("option", { name: "2024" })).not.toBeInTheDocument();
  expect(screen.getByRole("img", { name: /Distribuição dos gastos por categoria/ })).toBeInTheDocument();
});

test("minimizes each section independently and remembers the preference", async () => {
  const { unmount } = render(<FinanceCategories />);
  await screen.findByRole("img", { name: /Gastos por categoria/ });
  fireEvent.click(screen.getByRole("button", { name: "Minimizar Gastos anuais por categoria" }));
  expect(screen.getByRole("button", { name: "Expandir Gastos anuais por categoria" })).toHaveAttribute("aria-expanded", "false");
  expect(screen.queryByRole("img", { name: /Gastos por categoria/ })).not.toBeInTheDocument();
  expect(screen.getByRole("img", { name: /Distribuição dos gastos por categoria/ })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Minimizar Gráfico de pizza por categoria" }));
  fireEvent.click(screen.getByRole("button", { name: "Minimizar Categorias" }));
  expect(screen.getByRole("textbox", { name: "Nome" })).toBeVisible();
  unmount();
  render(<FinanceCategories />);
  expect(screen.getByRole("button", { name: "Expandir Gastos anuais por categoria" })).toHaveAttribute("aria-expanded", "false");
  expect(screen.getByRole("button", { name: "Expandir Gráfico de pizza por categoria" })).toHaveAttribute("aria-expanded", "false");
  expect(screen.getByRole("button", { name: "Expandir Categorias" })).toHaveAttribute("aria-expanded", "false");
  await waitFor(() => expect(screen.getAllByText("Moradia").length).toBeGreaterThan(0));
});
