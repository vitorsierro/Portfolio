'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { logout } from '../../lib/auth';
import { TOOLS } from '../../lib/tools';
import styles from '../../styles/AdminHeader.module.css';

const NAV = [
  { href: '/admin', label: 'Painel' },
  { href: '/admin/posts/new', label: 'Novo post' },
];

export default function AdminHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);

  async function onLogout() {
    setLeaving(true);
    // Revokes the tool session server-side too, so draw./claw. stop opening.
    await logout();
    router.replace('/admin/login');
  }

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <a href="/admin" className={styles.brand}>
          <span className={styles.brandEyebrow}>Vitor Sierro</span>
          <span className={styles.brandTitle}>Admin</span>
        </a>

        <button
          type="button"
          className={styles.toggle}
          aria-expanded={isOpen}
          aria-controls="admin-navigation"
          onClick={() => setIsOpen((current) => !current)}
        >
          {isOpen ? 'Fechar menu' : 'Menu'}
        </button>

        <div
          id="admin-navigation"
          className={`${styles.panel} ${isOpen ? styles.panelOpen : ''}`}
        >
          <nav className={styles.nav} aria-label="Navegacao do admin">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className={styles.link}
                aria-current={pathname === item.href ? 'page' : undefined}
                onClick={() => setIsOpen(false)}
              >
                {item.label}
              </a>
            ))}

            <span className={styles.divider} aria-hidden="true" />

            {TOOLS.map((tool) => (
              <a
                key={tool.key}
                href={tool.url}
                className={styles.link}
                onClick={() => setIsOpen(false)}
              >
                {tool.name}
                <span className={styles.external} aria-hidden="true">
                  ↗
                </span>
              </a>
            ))}
          </nav>

          <button
            type="button"
            className={styles.logout}
            onClick={onLogout}
            disabled={leaving}
          >
            {leaving ? 'Saindo…' : 'Sair'}
          </button>
        </div>
      </div>
    </header>
  );
}
