import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { FinanceDashboard, FinanceInvestments, FinanceTransactions } from "./FinancePages";
import { authFetch, ensureSession } from "../../lib/auth";

jest.mock("../../lib/auth", () => ({
  authFetch: jest.fn(),
  ensureSession: jest.fn(),
}));
jest.mock("react-pluggy-connect", () => ({
  PluggyConnect: ({ onSuccess }) =>
    require("react").createElement(
      "button",
      {
        type: "button",
        onClick: () => onSuccess({ item: { id: "pluggy-item-1" } }),
      },
      "Mock Pluggy Connect",
    ),
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
  window.history.replaceState({}, "", "/");
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

test("keeps cached dashboard figures visible when Pluggy sync fails", async () => {
  authFetch.mockImplementation(async (url) => ({
    status: 200,
    ok: true,
    json: async () =>
      url.includes("/overview")
        ? {
            pluggySyncUnavailable: true,
            totals: {
              expensesCents: 1250,
              incomeCents: 0,
              balanceCents: -1250,
              previousExpensesCents: 0,
              previousIncomeCents: 0,
            },
            categories: [],
            daily: [],
            recentTransactions: [],
          }
        : [],
  }));

  render(<FinanceDashboard />);
  expect(
    await screen.findByRole("region", { name: "Resumo do mês" }),
  ).toHaveTextContent(/R\$\s*12,50/);
  expect(await screen.findByRole("status")).toHaveTextContent(
    "últimos dados sincronizados",
  );
});

test("treats month-over-month income growth as favorable", async () => {
  const { container } = render(<FinanceDashboard />);
  const incomeChange = await screen.findByText(/400,0% vs\. mês anterior/);
  expect(incomeChange.className).toBe("goodChange");
  expect(container.querySelector(".badChange")).toBeNull();
});

test("creates a Pluggy Connect token and registers the connected item", async () => {
  const response = (data) => ({ status: 200, ok: true, json: async () => data });
  authFetch.mockImplementation(async (url, options = {}) => {
    if (url.endsWith("/pluggy/connect-token"))
      return response({ accessToken: "connect-token" });
    if (url.endsWith("/pluggy/connections") && options.method === "POST")
      return response({ id: "connection-1" });
    if (url.endsWith("/pluggy/sync"))
      return response({ connections: 1, importedTransactions: 1 });
    if (url.endsWith("/pluggy/connections")) return response([]);
    if (url.includes("/overview"))
      return response({
        totals: {
          expensesCents: 0,
          incomeCents: 0,
          balanceCents: 0,
          previousExpensesCents: 0,
          previousIncomeCents: 0,
        },
        categories: [],
        daily: [],
        recentTransactions: [],
      });
    return response({ items: [], totalPages: 1 });
  });

  render(<FinanceDashboard />);
  fireEvent.click(await screen.findByRole("button", { name: /Conectar banco/i }));
  fireEvent.click(await screen.findByRole("button", { name: "Mock Pluggy Connect" }));

  await waitFor(() =>
    expect(authFetch).toHaveBeenCalledWith(
      "/admin/finance/pluggy/connections",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ itemId: "pluggy-item-1" }),
      }),
    ),
  );
  expect(authFetch).toHaveBeenCalledWith(
    "/admin/finance/pluggy/sync",
    expect.objectContaining({ method: "POST" }),
  );
});

test("redirects to login when registering a Pluggy item returns 401", async () => {
  const response = (status, data = {}) => ({
    status,
    ok: status >= 200 && status < 300,
    json: async () => data,
  });
  authFetch.mockImplementation(async (url, options = {}) => {
    if (url.endsWith("/pluggy/connect-token"))
      return response(200, { accessToken: "connect-token" });
    if (url.endsWith("/pluggy/connections") && options.method === "POST")
      return response(401);
    if (url.endsWith("/pluggy/connections")) return response(200, []);
    if (url.includes("/overview"))
      return response(200, {
        totals: {
          expensesCents: 0,
          incomeCents: 0,
          balanceCents: 0,
          previousExpensesCents: 0,
          previousIncomeCents: 0,
        },
        categories: [],
        daily: [],
        recentTransactions: [],
      });
    return response(200, { items: [], totalPages: 1 });
  });

  render(<FinanceDashboard />);
  fireEvent.click(await screen.findByRole("button", { name: /Conectar banco/i }));
  fireEvent.click(await screen.findByRole("button", { name: "Mock Pluggy Connect" }));

  await waitFor(() => expect(mockRouter.replace).toHaveBeenCalled());
});

test("redirects to login when post-connect Pluggy sync returns 401", async () => {
  const response = (status, data = {}) => ({
    status,
    ok: status >= 200 && status < 300,
    json: async () => data,
  });
  authFetch.mockImplementation(async (url, options = {}) => {
    if (url.endsWith("/pluggy/connect-token"))
      return response(200, { accessToken: "connect-token" });
    if (url.endsWith("/pluggy/connections") && options.method === "POST")
      return response(200, { id: "connection-1" });
    if (url.endsWith("/pluggy/sync")) return response(401);
    if (url.endsWith("/pluggy/connections")) return response(200, []);
    if (url.includes("/overview"))
      return response(200, {
        totals: {
          expensesCents: 0,
          incomeCents: 0,
          balanceCents: 0,
          previousExpensesCents: 0,
          previousIncomeCents: 0,
        },
        categories: [],
        daily: [],
        recentTransactions: [],
      });
    return response(200, { items: [], totalPages: 1 });
  });

  render(<FinanceDashboard />);
  fireEvent.click(await screen.findByRole("button", { name: /Conectar banco/i }));
  fireEvent.click(await screen.findByRole("button", { name: "Mock Pluggy Connect" }));

  await waitFor(() => expect(mockRouter.replace).toHaveBeenCalled());
});

test("redirects to login when manual Pluggy sync returns 401", async () => {
  const response = (status, data = {}) => ({
    status,
    ok: status >= 200 && status < 300,
    json: async () => data,
  });
  authFetch.mockImplementation(async (url) => {
    if (url.endsWith("/pluggy/sync")) return response(401);
    if (url.endsWith("/pluggy/connections"))
      return response(200, [
        { id: "connection-1", institutionName: "Banco de teste", status: "UPDATED" },
      ]);
    if (url.includes("/overview"))
      return response(200, {
        totals: {
          expensesCents: 0,
          incomeCents: 0,
          balanceCents: 0,
          previousExpensesCents: 0,
          previousIncomeCents: 0,
        },
        categories: [],
        daily: [],
        recentTransactions: [],
      });
    return response(200, { items: [], totalPages: 1 });
  });

  render(<FinanceDashboard />);
  const refreshButton = await screen.findByRole("button", { name: "Atualizar agora" });
  await waitFor(() => expect(refreshButton).toBeEnabled());
  fireEvent.click(refreshButton);

  await waitFor(() => expect(mockRouter.replace).toHaveBeenCalled());
});

test("preserves the successful sync status when the follow-up dashboard is stale", async () => {
  const response = (data) => ({ status: 200, ok: true, json: async () => data });
  const connection = { id: "connection-1", institutionName: "Banco de teste", status: "UPDATED" };
  authFetch.mockImplementation(async (url) => {
    if (url.endsWith("/pluggy/sync"))
      return response({ importedTransactions: 1 });
    if (url.endsWith("/pluggy/connections")) return response([connection]);
    if (url.includes("/overview"))
      return response({
        pluggySyncUnavailable: true,
        totals: {
          expensesCents: 1250,
          incomeCents: 0,
          balanceCents: -1250,
          previousExpensesCents: 0,
          previousIncomeCents: 0,
        },
        categories: [],
        daily: [],
        recentTransactions: [],
      });
    return response({ items: [], totalPages: 1 });
  });

  render(<FinanceDashboard />);
  const refreshButton = await screen.findByRole("button", { name: "Atualizar agora" });
  await waitFor(() => expect(refreshButton).toBeEnabled());
  fireEvent.click(refreshButton);

  expect(
    await screen.findByText("Contas e lançamentos atualizados pela Pluggy."),
  ).toBeInTheDocument();
  expect(
    await screen.findByText(/Não foi possível atualizar a Pluggy agora/),
  ).toBeInTheDocument();
});

test("clears the stale-data warning after a successful dashboard refresh", async () => {
  let overviewRequests = 0;
  const response = (data) => ({ status: 200, ok: true, json: async () => data });
  authFetch.mockImplementation(async (url) => {
    if (url.includes("/overview")) {
      const stale = overviewRequests++ === 0;
      return response({
        pluggySyncUnavailable: stale,
        totals: {
          expensesCents: 0,
          incomeCents: 0,
          balanceCents: 0,
          previousExpensesCents: 0,
          previousIncomeCents: 0,
        },
        categories: [],
        daily: [],
        recentTransactions: [],
      });
    }
    if (url.endsWith("/pluggy/connections")) return response([]);
    return response({ items: [], totalPages: 1 });
  });

  render(<FinanceDashboard />);
  expect(await screen.findByText(/Não foi possível atualizar a Pluggy agora/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Mês anterior" }));
  await waitFor(() =>
    expect(screen.queryByText(/Não foi possível atualizar a Pluggy agora/)).not.toBeInTheDocument(),
  );
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

test("shows category-specific expense total when opening a category link", async () => {
  const response = (data) => ({ status: 200, ok: true, json: async () => data });
  window.history.replaceState(
    {},
    "",
    "/admin/finance/transactions?month=2026-06&categoryId=food-1",
  );
  authFetch.mockImplementation(async (url) =>
    url.includes("/categories")
      ? response([{ id: "food-1", name: "Alimentação" }])
      : response({
          items: [
            { ...row, amountCents: 1000, categoryId: "food-1" },
            {
              ...row,
              id: "income-1",
              kind: "income",
              amountCents: 5250,
              categoryId: "food-1",
            },
          ],
          totalAmountCents: 6250,
          totalExpenseAmountCents: 1000,
          totalPages: 1,
        }),
  );

  render(<FinanceTransactions />);
  const summary = await screen.findByRole("region", {
    name: "Resumo da categoria",
  });
  expect(summary).toHaveTextContent("Alimentação");
  expect(summary).toHaveTextContent("R$ 10,00");
  await waitFor(() =>
    expect(authFetch).toHaveBeenCalledWith(
      expect.stringContaining("categoryId=food-1"),
    ),
  );
});

test("allows editing Pluggy transactions but sends only editable fields", async () => {
  const response = (data) => ({ status: 200, ok: true, json: async () => data });
  authFetch.mockImplementation(async (url) =>
    url.includes("/categories")
      ? response([{ id: "food-1", name: "Alimentação" }])
      : response({
          items: [{ ...row, source: "pluggy", categoryId: "food-1" }],
          totalAmountCents: 4500,
          totalPages: 1,
        }),
  );

  render(<FinanceTransactions />);
  fireEvent.click(await screen.findByRole("button", { name: "Editar Mercado" }));
  fireEvent.change(screen.getByLabelText("Descrição"), {
    target: { value: "Mercado atualizado" },
  });
  fireEvent.change(screen.getByLabelText("Valor (R$)"), {
    target: { value: "99,90" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Salvar lançamento" }));

  await waitFor(() =>
    expect(authFetch).toHaveBeenCalledWith(
      "/admin/finance/transactions/tx-1",
      expect.objectContaining({ method: "PATCH" }),
    ),
  );
  const request = authFetch.mock.calls.find(
    ([url, options]) => url.endsWith("/tx-1") && options?.method === "PATCH",
  );
  expect(JSON.parse(request[1].body)).toEqual({
    description: "Mercado atualizado",
    amountCents: 9990,
    categoryId: "food-1",
  });
});

test("displays expenses in red", async () => {
  const { container } = render(<FinanceTransactions />);
  const amount = await screen.findByText(/45,00/);
  expect(amount.className).toContain("expenseAmount");
  expect(container.querySelector(".incomeAmount")).toBeNull();
});

test("creates an investment and sends its value in cents", async () => {
  const response = (data) => ({ status: 200, ok: true, json: async () => data });
  authFetch.mockImplementation(async (url, options = {}) =>
    url.endsWith("/investments") && options.method === "POST"
      ? response({ id: "investment-1" })
      : response({ items: [], total: 0, totalAmountCents: 0, totalPages: 1 }),
  );

  render(<FinanceInvestments />);
  fireEvent.click(
    await screen.findByRole("button", { name: "+ Novo investimento" }),
  );
  fireEvent.change(screen.getByLabelText("Nome do investimento"), {
    target: { value: "Tesouro Selic" },
  });
  fireEvent.change(screen.getByLabelText("Valor (R$)"), {
    target: { value: "1.234,56" },
  });
  fireEvent.change(screen.getByLabelText("Categoria do investimento"), {
    target: { value: "Tesouro Direto" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Salvar investimento" }));

  await waitFor(() =>
    expect(authFetch).toHaveBeenCalledWith(
      "/admin/finance/investments",
      expect.objectContaining({ method: "POST" }),
    ),
  );
  const request = authFetch.mock.calls.find(
    ([url, options]) => url === "/admin/finance/investments" && options?.method === "POST",
  );
  expect(JSON.parse(request[1].body)).toMatchObject({
    name: "Tesouro Selic",
    amountCents: 123456,
    category: "Tesouro Direto",
  });
});

test("edits an existing investment", async () => {
  const response = (data) => ({ status: 200, ok: true, json: async () => data });
  const item = {
    id: "investment-1",
    name: "Tesouro Selic",
    amountCents: 10000,
    category: "Tesouro Direto",
    acquiredAt: "2026-06-05T12:00:00.000Z",
  };
  authFetch.mockImplementation(async (url, options = {}) =>
    url.endsWith("/investments/investment-1") && options.method === "PATCH"
      ? response({ ...item, name: "Tesouro IPCA" })
      : response({ items: [item], total: 1, totalAmountCents: 10000, totalPages: 1 }),
  );

  render(<FinanceInvestments />);
  fireEvent.click(await screen.findByRole("button", { name: "Editar Tesouro Selic" }));
  fireEvent.change(screen.getByLabelText("Nome do investimento"), {
    target: { value: "Tesouro IPCA" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Salvar investimento" }));

  await waitFor(() =>
    expect(authFetch).toHaveBeenCalledWith(
      "/admin/finance/investments/investment-1",
      expect.objectContaining({ method: "PATCH" }),
    ),
  );
  const request = authFetch.mock.calls.find(
    ([url, options]) => url.endsWith("/investment-1") && options?.method === "PATCH",
  );
  expect(JSON.parse(request[1].body)).toMatchObject({ name: "Tesouro IPCA", amountCents: 10000 });
});
