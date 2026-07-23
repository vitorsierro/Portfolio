import { render, screen, within } from '@testing-library/react';
import Projetos from './Projetos';
import { projetos } from '../../test/fixtures/portfolio';

describe('Projetos', () => {
  it('renders one card per project from the data source', () => {
    render(<Projetos projetos={projetos} />);

    const cards = screen.getAllByRole('article');
    expect(cards).toHaveLength(projetos.length);

    const firstCard = cards[0];
    expect(within(firstCard).getByRole('heading', { name: projetos[0].titulo })).toBeInTheDocument();
    expect(
      within(firstCard).getByRole('link', { name: new RegExp(`abrir projeto ${projetos[0].titulo}`, 'i') })
    ).toHaveAttribute('href', projetos[0].link || projetos[0].link2);
    expect(within(firstCard).getByRole('link', { name: /ver estrutura/i })).toHaveAttribute(
      'href',
      projetos[0].link2
    );
  });
});
