import Link from "next/link"

import styled from '../../styles/Menu.module.css'

export default function Header() {
  return(
    <header className={styled.Menu}>
    <Link href="/"><h1 className={styled.Logo}>PORTFÓLIO</h1></Link>
    <nav>
      <ul>
        <Link href="/"><li>Home</li></Link>
        <Link href="#project"><li>Projetos</li></Link>
        <Link href="#experiency"><li>Experiência</li></Link>
        <Link href="#cursos"><li>Habilidades</li></Link>
        <Link href="#certificados"><li>Certificados</li></Link>
        <Link href="#sobre"><li>Sobre</li></Link>
      </ul>
    </nav>
    </header>
  )
};
