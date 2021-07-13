import Link from 'next/link'
import Image from 'next/image'

import { Divider, Typography, Row, Col } from 'antd';
import styled from '../../styles/Certificados.module.css'

import scrum from '../../public/scrum.png';
import devops from '../../public/devops.png';
import origamid from '../../public/origamid.png';
import alura from '../../public/alura.jpg';
import hcode from '../../public/hcode.png';

const { Title } = Typography;

export default function Certificados() {
	return (
		<>
			<Divider id="certificados" orientation="left" className={styled.Divider}>Certificados</Divider>
			<Row className={styled.Container}>
				<Col class={styled.ContainerCard} style={{height: '520px !important'}}>
					<header>
						<Image src={scrum} width={250} height={250} quality={100} />
						<Title level={3}>SCRUM FOUNDATION PROFESSIONAL CERTIFCATE(SFPC)</Title>
					</header>
					<main>
						<Link href="https://certiprof.com/pages/scrum-foundations-professional-certificate-sfpc-ptbr"><a target="_blank">
							<p>Ver mais</p>
						</a></Link>
					</main>
				</Col>
				<Col class={styled.ContainerCard} style={{height: '520px !important'}}>
					<header>
						<Image src={devops} width={250} height={250} quality={100} />
						<Title level={3}>DevOps Essentials Professional Certificate(DEPC)</Title>
					</header>
					<main>
						<Link href="https://certiprof.com/pages/devops-essentials-professional-certificate-depc"><a target="_blank">
							<p>Ver mais</p>
						</a></Link>
					</main>
				</Col>
			</Row>
			<Divider id="cursos" orientation="left" className={styled.Divider}>Cursos</Divider>
			<Row className={styled.Container}>
				<Col class={styled.ContainerCard}>
					<header>
						<Image src={alura} width={250} height={250} quality={100} />
						<Title level={3}>Formação Alura - React</Title>
					</header>
					<main>
						<Title level={5}>Formação ao qual a alura tem onde você passa por todo o react desde o basico até context api e teste.</Title>
						<Link href="https://www.alura.com.br/formacao-react-js"><a target="_blank">
							<p>Ver mais</p>
						</a></Link>
					</main>
				</Col>
				<Col class={styled.ContainerCard}>
					<header>
						<Image src={origamid} width={250} height={250} quality={100} />
						<Title level={3}>CSS FLEXBOX, BOOTSTRAP 4, Adobe XD, JAVASCRIPT e JQUERy</Title>
					</header>
					<main>
						<Title level={5}>Cursos feito na origamid ao qual tenho certificado.</Title>
						<Link href="https://www.origamid.com/curso/bootstrap-4/"><a target="_blank">
							<p>Ver mais</p>
						</a></Link>
					</main>
				</Col>
				<Col class={styled.ContainerCard}>
					<header>
						<Image src={hcode} width={250} height={250} quality={100} />
						<Title level={3}>PHP 7</Title>
					</header>
					<main>
					<Title level={5}>Cursos feito na udemy ao qual tenho certificado, foi desenvolvido um ecommerce do zero com php 7.</Title>
						<Link href="https://www.udemy.com/course/curso-php-7-online/learn/lecture/15933562?start=0#overview"><a target="_blank">
							<p>Ver mais</p>
						</a></Link>
					</main>
				</Col>
			</Row>
		</>
	);
};
