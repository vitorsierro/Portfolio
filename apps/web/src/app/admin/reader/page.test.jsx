import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ReaderPage from './page';
import { threadRequest } from '../../../lib/threadApi';
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('../../../lib/threadApi', () => ({ threadRequest: jest.fn() }));
beforeEach(() => { jest.clearAllMocks(); });

function open(url) {
  render(<ReaderPage />);
  fireEvent.change(screen.getByLabelText('Link de uma thread ou notícia'), { target: { value: url } });
  fireEvent.click(screen.getByRole('button', { name: 'Abrir leitura' }));
}

it('detects a news link and saves it to the shared library without preview metadata', async () => {
  threadRequest.mockResolvedValueOnce({ title: 'Notícia de teste', author: 'Autora', sourceUrl: 'https://www.uol.com.br/teste.htm', paragraphs: ['Primeiro parágrafo.', 'Segundo parágrafo.'], restricted: true })
    .mockResolvedValueOnce({ id: 'news-1' });
  open('https://www.uol.com.br/teste.htm');
  expect(await screen.findByDisplayValue('Notícia de teste')).toBeInTheDocument();
  expect(screen.getByText(/Esta matéria é marcada/)).toBeInTheDocument();
  expect(threadRequest).toHaveBeenNthCalledWith(1, '/admin/news/import', expect.any(Object));
  fireEvent.click(screen.getByRole('button', { name: 'Salvar na biblioteca' }));
  await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/admin/reader/saved/news-1'));
  const saved = JSON.parse(threadRequest.mock.calls[1][1].body);
  expect(saved).toMatchObject({ title: 'Notícia de teste', authorName: 'Autora', posts: [{ text: 'Primeiro parágrafo.\n\nSegundo parágrafo.', mediaUrls: [] }] });
  expect(saved).not.toHaveProperty('restricted');
});
it('detects X links, preserves translations and originals, and uses the same save flow', async () => {
  const imported = { title: 'Thread traduzida', sourceUrl: 'https://x.com/test/status/100', authorName: 'Autor', authorHandle: '@test', posts: [{ text: 'Olá', originalText: 'Hello', mediaUrls: [] }] };
  threadRequest.mockResolvedValueOnce(imported).mockResolvedValueOnce({ id: 'thread-1' });
  open(imported.sourceUrl);
  await screen.findByDisplayValue('Thread traduzida');
  expect(threadRequest).toHaveBeenNthCalledWith(1, '/admin/threads/import', expect.any(Object));
  expect(screen.getByText('Ver original')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Salvar na biblioteca' }));
  await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/admin/reader/saved/thread-1'));
  expect(JSON.parse(threadRequest.mock.calls[1][1].body)).toEqual(imported);
});
it('shows import failures in the unified reader', async () => {
  threadRequest.mockRejectedValue(new Error('Texto indisponível.'));
  open('https://www.uol.com.br/teste.htm');
  expect(await screen.findByRole('alert')).toHaveTextContent('Texto indisponível.');
});
