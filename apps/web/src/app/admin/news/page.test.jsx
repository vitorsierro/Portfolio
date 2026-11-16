import { fireEvent, render, screen } from '@testing-library/react';
import NewsReaderPage from './page';
import { threadRequest } from '../../../lib/threadApi';
jest.mock('../../../lib/threadApi', () => ({ threadRequest: jest.fn() }));
beforeEach(() => jest.clearAllMocks());

it('opens the supplied link and displays the article with a source and access status', async () => {
  threadRequest.mockResolvedValue({ title: 'Notícia de teste', author: 'Autora', sourceUrl: 'https://www.uol.com.br/teste.htm', paragraphs: ['Primeiro parágrafo.', 'Segundo parágrafo.'], restricted: true });
  render(<NewsReaderPage />);
  fireEvent.change(screen.getByLabelText('Link da notícia'), { target: { value: 'https://www.uol.com.br/teste.htm' } });
  fireEvent.click(screen.getByRole('button', { name: 'Abrir notícia' }));
  expect(await screen.findByRole('heading', { name: 'Notícia de teste' })).toBeInTheDocument();
  expect(screen.getByText('Segundo parágrafo.')).toBeInTheDocument();
  expect(screen.getByText(/trechos restritos podem estar ausentes/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Abrir fonte original ↗' })).toHaveAttribute('href', 'https://www.uol.com.br/teste.htm');
});
it('shows the source error without presenting an empty article as success', async () => {
  threadRequest.mockRejectedValue(new Error('Texto indisponível.'));
  render(<NewsReaderPage />);
  fireEvent.change(screen.getByLabelText('Link da notícia'), { target: { value: 'https://www.uol.com.br/teste.htm' } });
  fireEvent.click(screen.getByRole('button', { name: 'Abrir notícia' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Texto indisponível.');
});
