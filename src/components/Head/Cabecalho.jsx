import Head from 'next/head';

export default function Cabecalho() {
  return (
    <Head>
      <meta httpEquiv="content-language" content="pt-BR" />
      <meta httpEquiv="content-type" content="text/html; charset=UTF-8" />
      <title>Portfolio | Vitor Sierro</title>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta
        name="description"
        content="Portfolio com projetos, experiencia profissional, certificados e cursos de Vitor Sierro."
      />
      <meta name="rating" content="general" />
      <meta name="robots" content="index, nofollow" />
      <meta name="author" content="Vitor Sierro" />
      <meta name="keywords" content="Site, web, desenvolvimento next, React.js, Api/Rest, api, axios, ant-design" />
    </Head>
  );
}
