import { render, screen } from '@testing-library/react';
import Certificados from './Certificados';
import { certificados, cursos } from '../../test/fixtures/portfolio';

describe('Certificados', () => {
  it('renders certificates and courses from the data file', () => {
    render(<Certificados certificados={certificados} cursos={cursos} />);

    const cards = screen.getAllByRole('article');
    expect(cards).toHaveLength(certificados.length + cursos.length);
    expect(screen.getByRole('heading', { name: /cursos/i, level: 2 })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /abrir certificado/i })).toHaveLength(
      certificados.length
    );
    expect(screen.getAllByRole('link', { name: /abrir curso/i })).toHaveLength(cursos.length);
  });
});
