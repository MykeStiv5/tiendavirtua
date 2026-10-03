import { useState } from 'react';

export default function Footer() {
  const [subscribed, setSubscribed] = useState(false);

  // TODO: conecta aquí tu servicio de newsletter (Mailchimp, Resend, tabla en Supabase, etc.)
  const handleSubscribe = (event) => {
    event.preventDefault();
    setSubscribed(true);
    event.target.reset();
  };

  return (
    <footer className="footer">
      <div>
        <a href="#/" className="brand brand--inverse">
          <span>AREA</span>
          <strong>11</strong>
        </a>

        <p>Streetwear funcional diseñado y producido en Bogotá.</p>
      </div>

      <div className="footer__column">
        <span>EXPLORA</span>
        <a href="#productos">Nuevo</a>
        <a href="#productos">Colecciones</a>
        <a href="#/">Archivo</a>
      </div>

      <div className="footer__column">
        <span>AYUDA</span>
        <a href="#/track">Rastrear pedido</a>
        <a href="#/">Envíos y cambios</a>
        <a href="#/">Contacto</a>
      </div>

      <div className="footer__newsletter">
        <span>ÚNETE AL DROP</span>
        <p>{subscribed ? '¡Listo! Te avisaremos del próximo drop.' : 'Acceso anticipado. Sin spam.'}</p>

        <form onSubmit={handleSubscribe}>
          <input type="email" placeholder="TU EMAIL" aria-label="Correo electrónico" required />

          <button type="submit" aria-label="Suscribirme">→</button>
        </form>
      </div>
    </footer>
  );
}
