import Certificados from "../Certificado/Certificados";
import Experiencia from "../Experiencia/Experiencia";
import Projetos from "../Projetos/Projetos";
import Sobre from "../Sobre/Sobre";

export default function Conteudo() {
  return(
    <main>
    <Projetos />
    <Experiencia />
    <Certificados />
    <Sobre />    
    </main>
  )
};
