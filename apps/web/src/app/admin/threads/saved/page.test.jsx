import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SavedThreadsPage from './page';
import { threadRequest } from '../../../../lib/threadApi';

jest.mock('../../../../lib/threadApi', () => ({ threadRequest: jest.fn() }));
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...props }) => <a href={href} {...props}>{children}</a>,
}));

const thread = {
  id: 'saved-1',
  title: 'Minha thread',
  sourceUrl: 'https://x.com/teste/status/2112184574721548387',
  authorName: 'Pessoa de Teste',
  authorHandle: '@teste',
  postCount: 1,
  preview: 'Texto do post',
  updatedAt: '2026-10-17T12:00:00.000Z',
  posts: [{ text: 'Texto do post', mediaUrls: [] }],
};

beforeEach(() => {
  jest.clearAllMocks();
  threadRequest.mockImplementation(async (path) => path === '/admin/threads' ? [thread] : thread);
});

async function openEditor() {
  render(<SavedThreadsPage />);
  const editButton = await screen.findByRole('button', { name: 'Editar' });
  fireEvent.click(editButton);
  await screen.findByRole('dialog', { name: 'Revise o título e os posts.' });
  return { editButton };
}

test('focuses the edit dialog and restores focus to its opener on Escape', async () => {
  const { editButton } = await openEditor();
  const titleInput = screen.getByRole('textbox', { name: 'Título' });

  expect(titleInput).toHaveFocus();
  fireEvent.keyDown(titleInput, { key: 'Escape' });

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(editButton).toHaveFocus();
});

test('returns focus to the library search when saving removes the edit opener during reload', async () => {
  await openEditor();
  const searchInput = screen.getByRole('searchbox', { name: 'Buscar na biblioteca' });
  threadRequest.mockImplementation(async (path) => {
    if (path === '/admin/threads') {
      await new Promise((resolve) => setTimeout(resolve, 20));
      return [thread];
    }
    return thread;
  });

  fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  await screen.findByRole('button', { name: 'Editar' });
  await waitFor(() => expect(searchInput).toHaveFocus());
});

test('keeps keyboard focus inside the edit dialog when tabbing past its last control', async () => {
  await openEditor();
  const closeButton = screen.getByRole('button', { name: 'Fechar edição' });
  const saveButton = screen.getByRole('button', { name: 'Salvar alterações' });

  saveButton.focus();
  fireEvent.keyDown(saveButton, { key: 'Tab' });

  expect(closeButton).toHaveFocus();
});
