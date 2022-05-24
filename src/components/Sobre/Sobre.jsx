import Link from 'next/link'
import Image from 'next/image'
import { Typography, Divider } from 'antd';
import github from '../../public/github.png'
import linkedin from '../../public/linkedin.png'
import cv from '../../public/cv.png'
import fotoPerfil from '../../public/fotoPerfil.jpg'

import styled from '../../styles/Sobre.module.css'


const { Title } = Typography;

export default function Sobre() {
  const curriculum = "https://1drv.ms/w/s!Aoet_ZIDQNAOg7A8nD3F1q4yMwb_0g?e=nAoaA5";
  const fontStyle = "https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&family=Roboto+Mono:ital@1&display=swap";
  return (
    <>
    <Divider id="sobre" orientation="left" className={styled.Divider}>Sobre</Divider>
    <div className={styled.Container}>  
        <div className={styled.Sobre}>
        <link href={fontStyle} rel="stylesheet"/>
          <Title>Vitor Sierro</Title>
          <Title level={2}>Desenvolvidor Front-End</Title>
          <Title level={4}>Guarujá * São Paulo * Brasil</Title>
          <div className={styled.Pessoal}>
            <Title level={4}><Link href="tel:+5513996906052"><a target="_blank">(13)99690-6052</a></Link></Title>
            <Title level={4}><Link href="mailto:vitorsierro_@hotmail.com"><a target="_blank">vitorsierro_@hotmail.com</a></Link></Title>
          </div>
          <br />
          <hr />
          <Title level={4}>Desenvolvedor Front-End e Autodidata</Title>
          <Title level={4}>Em busca de alguma oportunidade no mercado de trabalho</Title>
          <Title level={4}>Estudando e se especializando em Front-End, Frameworks e Tecnologias Novas</Title>
          <div className={styled.Icons}>
            <Link href='https://github.com/vitorsierro'>
              <a target="_blank">
                <Image src={github} placeholder="blur"
                  width={50} height={50} quality={100}
                  alt="Icon of the github" /></a></Link>
            <Link href='https://www.linkedin.com/in/vitor-sierro/'>
              <a target="_blank">
                <Image src={linkedin} placeholder="blur"
                  width={50} height={50} quality={100}
                  alt="Icon of the linkedIn" /></a></Link>
            <Link href={curriculum}>
              <a target="_blank">
                <Image src={cv} placeholder="blur"
                  width={50} height={50} quality={100}
                  alt="Picture of the curriculum" /></a></Link>
          </div>
        </div>
      <div className={styled.FotoPerfil}>
        <Image src={fotoPerfil} placeholder="blur"
        width={550} height={550} quality={100}
        alt="Picture of the my" />
      </div>
    </div>
    </>
  )
};
