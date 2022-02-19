import { Divider, Typography } from 'antd';
import styled from '../../styles/Experiencia.module.css'

const { Title } = Typography;

export default function Experiencia() {
  return (
    <div>
      <Divider id="experiency" orientation="left" className={styled.Divider}>Experiência Profissional</Divider>
      <div className={styled.Experiencia}>
        <div>
          <Title level={2}>ESTAGIÁRIO DE ENGENHARIA DE SOFTWARE</Title>
          <Title level={2}>DE 03/2020 ATÉ 12/2020</Title>
        </div>
        <Title level={4} className={styled.ExperienciaH4}>ITAÚ UNIBANCO</Title>
        <hr />
        <Title level={5}>Atuei com Peoplesoft e Oracle DB<br/>
        Utilizando metodologias ageis e desenvolvimento voltado a teste</Title>
      </div>
      <div className={styled.Experiencia}>
        <div>
          <Title level={2}>ESTAGIÁRIO DE MANUTENÇÃO DE COMPUTADOR</Title>
          <Title level={2}>DE 03/2019 ATÉ 02/2020</Title>
        </div>
        <Title level={4} className={styled.ExperienciaH4}>SECRETARIA DE SAÚDE - PREFEITURA DE GUARUJÁ</Title>
        <hr />
        <Title level={5}>Atuei com Manutenção de computadores, faturamento de algumas unidades de saúde e ajudava os responsaveis de unidade com o departamento de ti.<br/>
        Utilizando as ferramentas do governo federal(ESUS, GIL, CADWEB)</Title>
      </div>
      <div className={styled.Experiencia}>
        <div>
          <Title level={2}>Desenvolvedor Web JR</Title>
          <Title level={2}>DE 05/20221 ATÉ 11/2021</Title>
        </div>
        <Title level={4} className={styled.ExperienciaH4}>KF Bank</Title>
        <hr />
        <Title level={5}>Atuei como Desenvolvedor web criando alguns prototipos em react com o framework next e trabalhando com wordpress para alguns projetos internos</Title>
      </div>
      <div className={styled.Experiencia}>
        <div>
          <Title level={2}>Entry Level Software Developer JR</Title>
          <Title level={2}>DE 11/2021 ATÉ HOJE</Title>
        </div>
        <Title level={4} className={styled.ExperienciaH4}>Philips</Title>
        <hr />
        <Title level={5}>Atuei como desenvolvedor java criando endpoint para se comunicar com o sistema tasy no primeiro momento e atualmente com o sistema tasy na parte de contabilidade do sistema </Title>
      </div>
    </div>
  )
};
