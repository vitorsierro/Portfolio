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
    </div>
  )
};
