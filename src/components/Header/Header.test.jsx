import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Header from './Header';

describe('Header', () => {
  it('opens the navigation menu on mobile toggle', async () => {
    render(<Header />);

    const toggle = screen.getByRole('button', { name: /abrir menu/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(toggle);

    expect(screen.getByRole('button', { name: /fechar menu/i })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: /certificados/i })).toBeInTheDocument();
  });
});
