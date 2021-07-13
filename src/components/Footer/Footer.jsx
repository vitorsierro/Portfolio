import { Typography } from "antd";

const { Title } = Typography;

export default function Footer() {
  return(
    <footer style={{display:'block'}}>
      <Title level={4} 
      style={{
        textAlign:'center', 
        background:'#696969',
        color:'#DCDCDC'}}
      >Todos os direitos reservados ao vitor sierro</Title>
    </footer>
  )
};
