import Link from 'next/link'
import Image from 'next/image'
import { Typography, Divider } from 'antd';
import styled from '../../styles/Sobre.module.css'
import dados from '../../../dados.json';

const { Title } = Typography;

export default function Sobre() {
  const fontStyle = "https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&family=Roboto+Mono:ital@1&display=swap";
  const dados_pessoais = dados["DADOS_PESSOAIS"];
  return (
    <>
    <Divider id="sobre" orientation="left" className={styled.Divider}>Sobre</Divider>
    <div className={styled.Container}>  
      
        {dados_pessoais.map(({nome,cargo,endereco,phone,telefone,email,foco,sobre_mim,links,photo},key) => ( 
          <>
          <div className={styled.Sobre}>
            <link href={fontStyle} rel="stylesheet" key={key}/>
            <Title>{nome}</Title>
            <Title level={2}>{cargo}</Title>
            <Title level={4}>{endereco}</Title>
            <div className={styled.Pessoal}>
              <Title level={4}><Link href={`tel:+${phone}`}><a target="_blank">{telefone}</a></Link></Title>
              <Title level={4}><Link href="mailto:vitorsierro_@hotmail.com"><a target="_blank">{email}</a></Link></Title>
            </div>
            <br /><hr />
            <Title level={4}>{foco}</Title>
            <br />
            <Title level={4}>{sobre_mim}</Title>
            <div className={styled.Icons}>
              {links.map(({link,img,alt},key) => (
                  <Link href={link} key={key}><a target="_blank">
                  <Image src={img} desfoqueDataURL ="blur"
                    width={50} height={50} quality={100}
                    alt={alt} /></a></Link>
              ))}
            </div>
          </div>
          <div className={styled.FotoPerfil}>
          <Image src={photo} desfoqueDataURL ="blur" width={550} height={550} quality={100}
          alt="Picture of the my" />
          </div>
      </>
        ))}
  </div>
    </>
  )
};
