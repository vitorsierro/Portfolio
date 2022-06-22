import Link from 'next/link';
import Image from 'next/image'

import { Row, Col, Divider, Typography, Tag } from 'antd';
import styled from '../../styles/Projetos.module.css'

const { Title } = Typography;

import dados from '../../../dados.json';

export default function Projetos() {
  const projetos = dados["projetos"];
  return (
    <>
      <Divider id="project" orientation="left" className={styled.Divider}>Projetos</Divider>
      <Row className={styled.Container}>
      {
        projetos.map(({titulo,empresa,link,img,conteudo,tags},key) => (
            <Col className={styled.Projetos} span={7} key={key}>
            <Link href={link} >
              <a target='_blank'>
                <div className={styled.Image}>
                  <Image src={img} desfoquedataurl="blur" width='250%' height='250%' />
                </div>
                <div className={styled.Conteudo}>
                  <hr />
                  <Title level={3}>{titulo}</Title>
                  <p>{conteudo}</p>
                  <p className={styled.Empresa}>{empresa}</p>
                  <div className={styled.Line}>
                  {tags.map((tag,key) => (
                      <Tag key={key} color='blue' className={styled.Tag}>{tag}</Tag>
                  ))}</div>
                </div>
              </a></Link>
            <Link href="https://github.com/vitorsierro/Nature" ><a target='_blank'>
              <p className={styled.ConteudoLink}>Saiba mais sobre a estrutura</p></a></Link>
          </Col>
          ))
			}
      </Row>
    </>
  )
};
