import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { FinanceDashboard, FinanceTransactions } from "./FinancePages";
import { authFetch, ensureSession } from "../../lib/auth";

jest.mock("../../lib/auth", () => ({
  authFetch: jest.fn(),
  ensureSession: jest.fn(),
}));
const mockRouter = { replace: jest.fn() };
jest.mock("next/navigation", () => ({ useRouter: () => mockRouter }));

const row = {
  id: "tx-1",
  description: "Mercado",
  amountCents: 4500,
  kind: "expense",
  occurredAt: "2026-06-05T12:00:00.000Z",
  categoryId: null,
  category: null,
  accountName: "Conta principal",
};

beforeEach(() => {
  jest.clearAllMocks();
  ensureSession.mockResolvedValue(true);
  authFetch.mockImplementation(async (url) => ({
    status: 200,
    ok: true,
    json: async () =>
      url.includes("/overview")
        ? {
            totals: {
              expensesCents: 3000,
              incomeCents: 5000,
              balanceCents: 2000,
              previousExpensesCents: 5000,
              previousIncomeCents: 1000,
            },
            categories: [],
            daily: [{ day: 1, expensesCents: 3000 }],
            recentTransactions: [],
          }
        : url.includes("/categories")
          ? []
          : { items: [row], totalPages: 1 },
  }));
});

test("shows a recoverable error when the dashboard request fails", async () => {
  authFetch.mockRejectedValueOnce(new Error("offline"));
  render(<FinanceDashboard />);
  expect(
    await screen.findByText(/Não foi possível carregar as finanças/),
  ).toBeInTheDocument();
});

test("treats month-over-month income growth as favorable", async () => {
  const { container } = render(<FinanceDashboard />);
  const incomeChange = await screen.findByText(/400,0% vs\. mês anterior/);
  expect(incomeChange.className).toBe("goodChange");
  expect(container.querySelector(".badChange")).toBeNull();
});

test("converts a period-decimal amount to integer cents when saving", async () => {
  render(<FinanceTransactions />);
  await screen.findByText("Mercado");
  fireEvent.click(screen.getByRole("button", { name: "+ Novo lançamento" }));
  fireEvent.change(screen.getByLabelText("Descrição"), {
    target: { value: "Café" },
  });
  fireEvent.change(screen.getByLabelText("Valor (R$)"), {
    target: { value: "12.50" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Salvar lançamento" }));
  await waitFor(() =>
    expect(authFetch).toHaveBeenCalledWith(
      "/admin/finance/transactions",
      expect.objectContaining({ method: "POST" }),
    ),
  );
  const request = authFetch.mock.calls.find(
    ([url, options]) =>
      url === "/admin/finance/transactions" && options?.method === "POST",
  );
  expect(JSON.parse(request[1].body).amountCents).toBe(1250);
});

test("closes the transaction editor when Escape is pressed", async () => {
  render(<FinanceTransactions />);
  await screen.findByText("Mercado");
  fireEvent.click(screen.getByRole("button", { name: "Editar Mercado" }));
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  fireEvent.keyDown(document, { key: "Escape" });
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
});
