import { useState } from 'react';
import styles from '../../styles/Menu.module.css';

const navItems = [
  { href: '#project', label: 'Projetos' },
  { href: '#experiencia', label: 'Experiencia' },
  { href: '#cursos', label: 'Habilidades' },
  { href: '#certificados', label: 'Certificados' },
  { href: '#sobre', label: 'Sobre' },
];

export default function Header() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <a href="/" className={styles.logoLink}>
          <span className={styles.logoEyebrow}>Vitor Sierro</span>
          <span className={styles.logoTitle}>Portfolio</span>
        </a>

        <button
          type="button"
          className={styles.toggle}
          aria-expanded={isOpen}
          aria-controls="site-navigation"
          onClick={() => setIsOpen((current) => !current)}
        >
          {isOpen ? 'Fechar menu' : 'Abrir menu'}
        </button>

        <nav
          id="site-navigation"
          className={`${styles.nav} ${isOpen ? styles.navOpen : ''}`}
          aria-label="Navegacao principal"
        >
          <ul className={styles.list}>
            <li>
              <a href="/" onClick={() => setIsOpen(false)}>
                Inicio
              </a>
            </li>
            {navItems.map((item) => (
              <li key={item.href}>
                <a href={item.href} onClick={() => setIsOpen(false)}>
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
