import '../styles/globals.css';

export const metadata = {
  title: 'Portfolio | Vitor Sierro',
  description:
    'Portfolio com projetos, experiencia profissional, certificados e cursos de Vitor Sierro.',
  authors: [{ name: 'Vitor Sierro' }],
  keywords: [
    'Site',
    'web',
    'desenvolvimento next',
    'React.js',
    'Api/Rest',
    'api',
    'axios',
  ],
  robots: 'index, nofollow',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
