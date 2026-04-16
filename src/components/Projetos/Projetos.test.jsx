import { render, screen, within } from '@testing-library/react';
import Projetos from './Projetos';
import dados from '../../../dados.json';

describe('Projetos', () => {
  it('renders one card per project from the data source', () => {
    render(<Projetos />);

    const cards = screen.getAllByRole('article');
    expect(cards).toHaveLength(dados.projetos.length);

    const firstCard = cards[0];
    expect(within(firstCard).getByRole('heading', { name: dados.projetos[0].titulo })).toBeInTheDocument();
    expect(
      within(firstCard).getByRole('link', { name: new RegExp(`abrir projeto ${dados.projetos[0].titulo}`, 'i') })
    ).toHaveAttribute('href', dados.projetos[0].link || dados.projetos[0].link2);
    expect(within(firstCard).getByRole('link', { name: /ver estrutura/i })).toHaveAttribute(
      'href',
      dados.projetos[0].link2
    );
  });
});
