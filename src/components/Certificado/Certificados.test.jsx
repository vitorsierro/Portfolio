import { render, screen } from '@testing-library/react';
import Certificados from './Certificados';
import dados from '../../../dados.json';

describe('Certificados', () => {
  it('renders certificates and courses from the data file', () => {
    render(<Certificados />);

    const cards = screen.getAllByRole('article');
    expect(cards).toHaveLength(dados.CERTIFICACAO.length + dados.CURSOS.length);
    expect(screen.getByRole('heading', { name: /cursos/i, level: 2 })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /abrir certificado/i })).toHaveLength(
      dados.CERTIFICACAO.length
    );
    expect(screen.getAllByRole('link', { name: /abrir curso/i })).toHaveLength(dados.CURSOS.length);
  });
});
