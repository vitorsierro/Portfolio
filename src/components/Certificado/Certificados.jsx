import Link from 'next/link'
import Image from 'next/image'

import { Divider, Typography, Row, Col } from 'antd';
import styled from '../../styles/Certificados.module.css'

import dados from '../../../dados.json';

const { Title } = Typography;


export default function Certificados() {
	const certificados = dados["CERTIFICACAO"];
	const cursos = dados["CURSOS"];
	return (
		<>
			<Divider id="certificados" orientation="left" className={styled.Divider}>Certificados</Divider>
			<Row className={styled.Container}>	
			{certificados.map(({titulo,empresa,link,img},key) => (
					<Col className={styled.ContainerCard} key={key} span={7}>
						<header>
							<Image src={img} width={250} height={250} quality={100} />
						</header>
						<main>
							<Title level={3}>{titulo}</Title>
							<Title level={3} className={styled.Empresa}>{empresa}</Title>
							<Link href={link}><a target="_blank">
								<p>Ver mais</p>
							</a></Link>
						</main>
					</Col>
				))
			}
			</Row>
			<Divider id="cursos" orientation="left" className={styled.Divider}>Cursos</Divider>
			<Row className={styled.Container}>	
			{cursos.map(({titulo,empresa,link,img,conteudo},key) => (

					<Col className={styled.ContainerCard} key={key} span={7}>
					<header>
						<Image src={img} width={250} height={250} quality={100} />						
					</header>
					<main>
						<Title level={3}>{titulo}</Title>
						<Title level={5}>{conteudo}</Title>
						<Title level={3} className={styled.Empresa}>{empresa}</Title>
						<Link href={link}><a target="_blank">
							<p>Ver mais</p>
						</a></Link>
					</main>
				</Col>				
				))
			}
			</Row>
				</>
	);
};
