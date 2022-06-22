import { Divider, Row, Typography, Tag } from 'antd';
import styled from '../../styles/Experiencia.module.css';
import dados from '../../../dados.json';
import Link from 'next/link';

const { Title } = Typography;

export default function Experiencia() {
  const projetos = dados["Experiencia_Profissional"];
  return (
    <>
      <Divider id="experiency" orientation="left" className={styled.Divider}>Experiência Profissional</Divider>
      <Row className={styled.Container}>
      {
        projetos.map(({cargo,empresa,conteudo,link,datas,tecnologias},key) => (
          <div className={styled.Experiencia} key={key}>
          <div className={styled.Line}>
            <Title level={2}>{cargo}</Title>
            <Title level={2}>{datas}</Title>
          </div>
          <Link href={link} ><a target='_blank'><Title level={4} className={styled.ExperienciaH4}>{empresa}</Title></a></Link>
          <hr />
          <Title level={5}>{conteudo}</Title>
          {tecnologias.map((tecnologia,key) => (
                       <Tag key={key} color='blue' className={styled.Tag}>{tecnologia}</Tag>
                  ))}
        </div>
          ))
			}
      </Row>
    </> 
  )
};
