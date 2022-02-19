import Link from 'next/link';
import Image from 'next/image'

import { Row, Col, Divider, Typography } from 'antd';
import styled from '../../styles/Projetos.module.css'

import nature from '../../public/nature-page.png'
import caravan from '../../public/caravan-page.png'
import marina from '../../public/marina-page.png'
import moveit from '../../public/moveit-page.png'
import formulario from '../../public/formulario-page.png'
import tractian from '../../public/tractian-page.png'
import dsvendas from '../../public/dsvendas-page.png'
import coodesh from '../../public/coodesh-page.png'
import kfbank from '../../public/kfbank.png'

const { Title } = Typography;

export default function Projetos() {
  return (
    <>
      <Divider id="project" orientation="left" className={styled.Divider}>Projetos</Divider>
      <Row className={styled.Container}>
        <Col className={styled.Projetos} span={7}>
          <Link href="https://vitorsierro.github.io/Nature/" >
            <a target='_blank'>
              <Image src={nature} placeholder="blur" />
              <div className={styled.Conteudo}>
                <hr />
                <Title level={3}>Nature</Title>
                <p>Curso da origamid ao qual foi desenvolvido um site fictio onde aborda a natureza feita com desenvolvimento ao jquery</p>
                <Title level={5}>#HTML5 #CSS3 #Javascript #Jquery </Title></div>
            </a></Link>
          <Link href="https://github.com/vitorsierro/Nature" ><a target='_blank'>
            <p className={styled.ConteudoLink}>Saiba mais sobre a estrutura</p></a></Link>
        </Col>
        <Col className={styled.Projetos} span={7}>
          <Link href="https://vitorsierro.github.io/Caravan/" ><a target='_blank'>
            <Image src={caravan} placeholder="blur" />
            <div className={styled.Conteudo}>
              <hr />
              <Title level={3}>Caravan</Title>
              <p>Curso da origamid ao qual foi desenvolvido o site fictio onde aborda um site de turismo utilizando slide e explorando o jquery e o html5 e css3</p>
              <Title level={5}>#HTML5 #CSS3 #Javascript #Jquery </Title>
            </div></a></Link>
          <Link href="https://github.com/vitorsierro/Caravan" ><a target='_blank'>
            <p className={styled.ConteudoLink}>Saiba mais sobre a estrutura</p></a></Link>
        </Col>
        <Col className={styled.Projetos} span={7}>
          <Link href="https://vitorsierro.github.io/marina-front-end/" ><a target='_blank'>
            <Image src={marina} placeholder="blur" />
            <div className={styled.Conteudo}>
              <hr />
              <Title level={3}>Marina</Title>
              <p className={styled.Conteudo}>Site criado com o fim de um projeto ao qual não foi para frente, desenvolvido para uma marina da região com api de previsão do tempo, previsão do mar e previsão de vento.</p>
              <Title level={5}>#HTML5 #CSS3 #Javascript #Jquery </Title>
            </div></a></Link>
          <Link href="https://github.com/vitorsierro/marina-front-end" ><a target='_blank'>
            <p className={styled.ConteudoLink}>Saiba mais sobre a estrutura</p></a></Link>
        </Col>
        <Col className={styled.Projetos} span={7}>
          <Link href="https://nlw-moveit-7nov1by65-vitorsierro.vercel.app/" ><a target='_blank'>
            <Image src={moveit} placeholder="blur" />
            <div className={styled.Conteudo}>
              <hr />
              <Title level={3}>Moveit</Title>
              <p className={styled.Conteudo}>Site desenvolvido para aprender react e next com a função de desafios de 30 minutos para focar estilo pomodoro</p>
              <Title level={5}>#React.js #Next.js #Javascript </Title>
            </div></a></Link>
          <Link href="https://nlw-moveit-7nov1by65-vitorsierro.vercel.app/" ><a target='_blank'>
            <p className={styled.ConteudoLink}>Saiba mais sobre a estrutura</p></a></Link>
        </Col>
        <Col className={styled.Projetos} span={7}>
          <Link href="https://formulario-react-js.vercel.app/" >
            <a target='_blank'>
              <Image src={formulario} placeholder="blur" />
              <div className={styled.Conteudo}>
                <hr />
                <Title level={3}>Formulario React.js</Title>
                <p >Criando Formulário utilizando react.js a biblioteca material IU e a api VIACEP</p>
                <Title level={5}>#React.js #Material IU #Javascript #API_VIACEP </Title></div>
            </a></Link>
          <Link href="https://github.com/vitorsierro/Formulario_React.js" ><a target='_blank'>
            <p className={styled.ConteudoLink}>Saiba mais sobre a estrutura</p></a></Link>
        </Col>
        <Col className={styled.Projetos} span={7}>
          <Link href="https://tractian-ashen.vercel.app/" >
            <a target='_blank'>
              <Image src={tractian} placeholder="blur" />
              <div className={styled.Conteudo}>
                <hr />
                <Title level={3}>Tractian</Title>
                <p className={styled.Conteudo}>Projeto da tractian para vaga de react front-end onde tive que desenvolver algumas telas com gráficos e tabela utilizando ant-design e Highcharts</p>
                <Title level={5}>#React.js #Ant_Design #Javascript #HighCharts </Title></div></a></Link>
          <Link href="https://github.com/vitorsierro/tractian"><a target='_blank'>
            <p className={styled.ConteudoLink}>Saiba mais sobre a estrutura</p></a></Link>
        </Col>
        <Col className={styled.Projetos} span={7}>
          <Link href="https://dev-superior-spring-react.vercel.app/dashboard" ><a target='_blank'>
            <Image src={dsvendas} placeholder="blur" />
            <div className={styled.Conteudo}>
              <hr />
              <Title level={3}>DevSuperior Vendas</Title>
              <p className={styled.Conteudo}>Curso da devsuperior utilizando spring e react para criar graficos ficticios</p>
              <Title level={5}>#Javascript #React.js #Java #Spring</Title></div></a></Link>
          <Link href="https://github.com/vitorsierro/DevSuperior_Spring_React" ><a target='_blank'>
            <p className={styled.ConteudoLink}>Saiba mais sobre a estrutura</p></a></Link>
        </Col>
        <Col className={styled.Projetos} span={7}>
          <Link href="https://challenge-coodesh.vercel.app/" >
            <a target='_blank'>
              <Image src={coodesh} placeholder="blur" />
              <div className={styled.Conteudo}>
                <hr />
                <Title level={3}>Coodesh Challenge</Title>
                <p className={styled.Conteudo}>challenge da coodesh onde o objetivo era criar um site em react utilizando uma api de wiki para buscar receita entre outras coisa</p>
                <Title level={5}>#Javascript #React.js #Ant_Design #API_Wiki</Title></div></a></Link>
          <Link href="https://github.com/vitorsierro/challenge_Coodesh" ><a target='_blank'>
            <p className={styled.ConteudoLink}>Saiba mais sobre a estrutura</p></a></Link>
        </Col>
        <Col className={styled.Projetos} span={7}>
          <Link href="https://kf-bank-prot.vercel.app/Users" >
            <a target='_blank'>
              <Image src={kfbank} placeholder="blur" />
              <div className={styled.Conteudo}>
                <hr />
                <Title level={3}>KF Bank - Prototipo </Title>
                <p className={styled.Conteudo}>Prototipo desenvolvido para a empresa kf bank com react js, next js e a lib de ant-design</p>
                <Title level={5}>#Javascript #React.js #Ant_Design #Google charts</Title></div></a></Link>
          <Link href="https://github.com/vitorsierro/kf_bank_prot" ><a target='_blank'>
            <p className={styled.ConteudoLink}>Saiba mais sobre a estrutura</p></a></Link>
        </Col>

      </Row>
    </>
  )
};
