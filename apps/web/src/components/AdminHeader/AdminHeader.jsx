'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { logout } from '../../lib/auth';
import { TOOLS } from '../../lib/tools';
import styles from '../../styles/AdminHeader.module.css';

const NAV = [
  { href: '/admin', label: 'Painel' },
  { href: '/admin/posts', label: 'Posts' },
  { href: '/admin/enseada', label: 'Enseada' },
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
          <span className={styles.brandEyebrow}>Bem-vindo</span>
          <span className={styles.brandTitle}>Vitor Sierro</span>
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

            {TOOLS.map((tool) => {
              // O Excalidraw abre embutido em /admin/draw (mantém este
              // header à vista). O OpenClaw proíbe iframe, então abre fora.
              const embedded = tool.key === 'draw';

              return (
                <a
                  key={tool.key}
                  href={embedded ? '/admin/draw' : tool.url}
                  className={styles.link}
                  target={embedded ? undefined : '_blank'}
                  rel={embedded ? undefined : 'noreferrer'}
                  aria-current={
                    embedded && pathname === '/admin/draw' ? 'page' : undefined
                  }
                  onClick={() => setIsOpen(false)}
                >
                  {tool.name}
                  {embedded ? null : (
                    <span className={styles.external} aria-hidden="true">
                      ↗
                    </span>
                  )}
                </a>
              );
            })}
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
