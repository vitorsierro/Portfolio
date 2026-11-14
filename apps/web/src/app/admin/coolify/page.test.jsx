import { render, screen, waitFor } from '@testing-library/react';
import CoolifyPage from './page';
import { authFetch } from '../../../lib/auth';

const mockRouter = { replace: jest.fn() };
jest.mock('../../../lib/auth', () => ({ authFetch: jest.fn() }));
// Manter a identidade do router estável como no Next, evitando repetir effects.
jest.mock('next/navigation', () => ({ useRouter: () => mockRouter }));

beforeEach(() => { jest.clearAllMocks(); });

test('mostra serviços e atalho protegido para o painel completo', async () => {
  authFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({
    collectedAt: '2026-11-14T07:06:04Z', coolifyAvailable: true,
    panelUrl: 'http://127.0.0.1:8000/',
    updates: { enabled: true, result: 'success', hermesVersion: '0.23.1', memoryVersion: '3.4.6' },
    services: [{ name: 'api', state: 'running', health: 'healthy', restarts: 0 }],
    deployments: [{ commit: 'abcdef123', status: 'finished', createdAt: '2026-11-14T07:00:00Z' }],
  }) });
  render(<CoolifyPage />);
  expect(await screen.findByRole('heading', { name: 'api' })).toBeInTheDocument();
  expect(screen.getByText('Saudável')).toBeInTheDocument();
  expect(screen.getByText('abcdef1')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Abrir painel completo/ })).toHaveAttribute('href', 'http://127.0.0.1:8000/');
  expect(screen.getByText(/ssh -N -L/)).toBeInTheDocument();
});

test('mantém o atalho disponível quando a coleta falha', async () => {
  authFetch.mockResolvedValue({ ok: false, status: 503 });
  render(<CoolifyPage />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível atualizar');
  expect(screen.getByRole('link', { name: /Abrir painel completo/ })).toBeInTheDocument();
});

test('redireciona uma sessão expirada para o login', async () => {
  authFetch.mockResolvedValue({ ok: false, status: 401 });
  render(<CoolifyPage />);
  await waitFor(() => expect(mockRouter.replace).toHaveBeenCalled());
});
