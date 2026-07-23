import { render, screen } from '@testing-library/react';
import Experiencia from './Experiencia';
import { experiencias } from '../../test/fixtures/portfolio';

describe('Experiencia', () => {
  it('renders the professional experiences from the data file', () => {
    render(<Experiencia experiencias={experiencias} />);

    expect(screen.getAllByRole('article')).toHaveLength(experiencias.length);
    expect(screen.getByRole('link', { name: /quality digital/i })).toBeInTheDocument();
    expect(screen.getAllByText(/react\.js/i).length).toBeGreaterThan(0);
  });
});
