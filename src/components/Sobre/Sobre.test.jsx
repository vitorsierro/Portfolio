import { render, screen } from '@testing-library/react';
import Sobre from './Sobre';
import dados from '../../../dados.json';

describe('Sobre', () => {
  it('renders the personal summary and social links', () => {
    render(<Sobre />);

    const perfil = dados.DADOS_PESSOAIS[0];

    expect(screen.getByRole('heading', { name: /sobre/i, level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: perfil.nome })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: perfil.email })).toHaveAttribute('href', `mailto:${perfil.email}`);
    expect(screen.getAllByRole('link')).toHaveLength(perfil.links.length + 1);
  });
});
