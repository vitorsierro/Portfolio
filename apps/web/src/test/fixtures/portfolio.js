export const projetos = [
  {
    titulo: 'PROJETO TESTE UM',
    img: '/teste-um.png',
    conteudo: 'Descricao do projeto de teste um.',
    tags: ['REACT.JS', 'JEST'],
    link: 'https://projeto-um.example.com',
    link2: 'https://github.com/example/projeto-um',
  },
  {
    titulo: 'PROJETO TESTE DOIS',
    img: '/teste-dois.png',
    conteudo: 'Descricao do projeto de teste dois.',
    tags: ['TYPESCRIPT', 'NEXT'],
    link: '',
    link2: 'https://github.com/example/projeto-dois',
  },
];

export const experiencias = [
  {
    cargo: 'DESENVOLVEDOR FRONTEND PLENO',
    empresa: 'Quality Digital',
    conteudo: 'Atuacao em projeto jamstack de teste.',
    datas: 'DE 01/2020 ATE HOJE',
    tecnologias: ['REACT.JS', 'TYPESCRIPT'],
    link: 'https://example.com/quality-digital',
  },
  {
    cargo: 'DESENVOLVEDOR JUNIOR',
    empresa: 'Empresa Exemplo',
    conteudo: 'Atuacao em projeto de teste.',
    datas: 'DE 01/2019 ATE 12/2019',
    tecnologias: [],
    link: 'https://example.com/empresa-exemplo',
  },
];

export const certificados = [
  {
    titulo: 'CERTIFICADO TESTE UM',
    img: '/certificado-um.png',
    empresa: 'CERTIPROF',
    link: 'https://example.com/certificado-um',
  },
  {
    titulo: 'CERTIFICADO TESTE DOIS',
    img: '/certificado-dois.png',
    empresa: 'CERTIPROF',
    link: 'https://example.com/certificado-dois',
  },
];

export const cursos = [
  {
    titulo: 'CURSO TESTE UM',
    conteudo: 'Descricao do curso de teste um.',
    empresa: 'ALURA',
    img: '/curso-um.png',
    link: 'https://example.com/curso-um',
  },
  {
    titulo: 'CURSO TESTE DOIS',
    conteudo: 'Descricao do curso de teste dois.',
    empresa: 'ORIGAMID',
    img: '/curso-dois.png',
    link: 'https://example.com/curso-dois',
  },
];

export const dadosPessoais = {
  nome: 'NOME TESTE',
  cargo: 'DESENVOLVEDOR FULLSTACK PLENO',
  email: 'teste@example.com',
  sobre_mim: 'Descricao de teste sobre o desenvolvedor.',
  links: [
    { link: 'https://github.com/example', img: '/github.png', alt: 'Icon of the github' },
    { link: 'https://linkedin.com/in/example', img: '/linkedin.png', alt: 'Icon of the linkedIn' },
  ],
};

export const portfolio = {
  projetos,
  Experiencia_Profissional: experiencias,
  CERTIFICACAO: certificados,
  CURSOS: cursos,
  DADOS_PESSOAIS: [dadosPessoais],
};
