import { render, screen } from '@testing-library/react';
import Home from '../pages/index';

describe('Home page', () => {
  it('renders the main sections of the portfolio', () => {
    render(<Home />);

    expect(screen.getByRole('navigation', { name: /navegacao principal/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /projetos/i, level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /experiencia profissional/i, level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /certificados/i, level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /sobre/i, level: 2 })).toBeInTheDocument();
    expect(screen.getByText(/todos os direitos reservados a vitor sierro/i)).toBeInTheDocument();
  });
});
