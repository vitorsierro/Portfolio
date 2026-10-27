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
