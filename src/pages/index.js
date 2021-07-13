import Conteudo from '../components/Conteudo/Conteudo'
import Footer from '../components/Footer/Footer'
import Cabecalho from '../components/Head/Cabecalho'
import Header from '../components/Header/Header'
import 'antd/dist/antd.css';

export default function Home() {
  return (
    <div>
      <Cabecalho />
      <Header />
      <Conteudo />
      <Footer />
    </div>
  )
}
