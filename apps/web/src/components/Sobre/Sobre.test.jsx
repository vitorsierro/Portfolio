import { render, screen } from '@testing-library/react';
import Sobre from './Sobre';
import { dadosPessoais } from '../../test/fixtures/portfolio';

describe('Sobre', () => {
  it('renders the personal summary and social links', () => {
    render(<Sobre dadosPessoais={dadosPessoais} />);

    expect(screen.getByRole('heading', { name: /sobre/i, level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: dadosPessoais.nome })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: dadosPessoais.email })).toHaveAttribute(
      'href',
      `mailto:${dadosPessoais.email}`
    );
    expect(screen.getAllByRole('link')).toHaveLength(dadosPessoais.links.length + 1);
  });
});
