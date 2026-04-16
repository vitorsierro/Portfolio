import { render, screen } from '@testing-library/react';
import Experiencia from './Experiencia';
import dados from '../../../dados.json';

describe('Experiencia', () => {
  it('renders the professional experiences from the data file', () => {
    render(<Experiencia />);

    expect(screen.getAllByRole('article')).toHaveLength(dados.Experiencia_Profissional.length);
    expect(screen.getByRole('link', { name: /quality digital/i })).toBeInTheDocument();
    expect(screen.getAllByText(/react\.js/i).length).toBeGreaterThan(0);
  });
});
