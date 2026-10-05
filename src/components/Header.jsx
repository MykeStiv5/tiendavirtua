import { useState } from 'react';
import { useCart } from '../context/CartContext';

export default function Header() {
  const { count } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const close = () => setMenuOpen(false);

  return (
    <header className="header">
      <button
        className="icon-button header__menu"
        type="button"
        aria-label="Abrir menú"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
      >
        <span></span>
        <span></span>
        <span></span>
      </button>

      <a href="#/" className="brand" aria-label="AREA 11, inicio" onClick={close}>
        <span>AREA</span>
        <strong>11</strong>
      </a>

      <nav
        className={`navigation${menuOpen ? ' is-open' : ''}`}
        aria-label="Navegación principal"
      >
        <a href="#productos" onClick={close}>NUEVO</a>
        <a href="#/hombre" onClick={close}>HOMBRE</a>
        <a href="#/mujer" onClick={close}>MUJER</a>
        <a href="#productos" onClick={close}>ACCESORIOS</a>
        <a href="#/track" className="navigation__mobile-only" onClick={close}>RASTREAR PEDIDO</a>
        <a href="#/account" className="navigation__mobile-only" onClick={close}>MI CUENTA</a>
      </nav>

      <div className="header__actions">
        <button
          className="header-action"
          type="button"
          onClick={() => {
            window.location.hash = '#productos';
          }}
        >
          <span className="header-action__icon" aria-hidden="true">⌕</span>
          <span className="header-action__label">BUSCAR</span>
        </button>

        <button className="header-action header-action--desktop" type="button">
          COL / COP
        </button>

        <a href="#/track" className="header-action header-action--desktop">
          RASTREAR
        </a>

        <a href="#/account" className="header-action header-action--desktop">
          MI CUENTA
        </a>

        <a href="#/cart" className="header-action bag-button">
          <span className="bag-icon" aria-hidden="true"></span>
          <span className="header-action__label">BOLSA</span>
          <strong>{count}</strong>
        </a>
      </div>
    </header>
  );
}
