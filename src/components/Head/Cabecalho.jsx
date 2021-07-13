import Head from 'next/head'

export default function Cabecalho() {
  return(
    <Head>
      <meta httpEquiv="content-language" content="pt-br" />
      <meta httpEquiv="content-type" content="text/html; charset=UTF-8" />
      
      <title>Portfólio</title>
      <meta name="viewport" content="initial-scale=1.0, width=device-width" />
      <meta name = "description" content = "Site criado para o fim de apresentar projetos criados, certificados e experiencias adquirido na minha carreira " />
      
      <meta name="rating" content="general" />
      <meta name = "robôs" content = "index, nofollow" />
      <meta name="author" content="Vitor Sierro"/>
      <meta name="keywords" content="Site, web, desenvolvimento next, React.js, Api/Rest, api, axios, ant-design" />
    </Head>
  )
};
