'use client';

import { usePathname } from 'next/navigation';
import AdminHeader from '../../components/AdminHeader/AdminHeader';
import styles from '../../styles/AdminLayout.module.css';

export default function AdminLayout({ children }) {
  const pathname = usePathname();

  // A tela de login é a única rota do admin sem sessão — mostrar um botão de
  // logout ali não faria sentido.
  const isLogin = pathname === '/admin/login';

  if (isLogin) {
    return children;
  }

  return (
    <div className={styles.root}>
      <AdminHeader />
      {children}
    </div>
  );
}
