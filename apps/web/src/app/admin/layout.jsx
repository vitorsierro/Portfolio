'use client';

import { usePathname } from 'next/navigation';
import AdminHeader from '../../components/AdminHeader/AdminHeader';

export default function AdminLayout({ children }) {
  const pathname = usePathname();

  // The login page is the one admin route without a session — showing a
  // logout button there would be nonsense.
  const isLogin = pathname === '/admin/login';

  return (
    <>
      {isLogin ? null : <AdminHeader />}
      {children}
    </>
  );
}
