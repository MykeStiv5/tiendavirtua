import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { looksLikeBot } from '../lib/antispam';
import Honeypot from './Honeypot';

export default function Footer() {
  const [subscribed, setSubscribed] = useState(false);
  const [error, setError] = useState('');
  const [trap, setTrap] = useState(''); // campo señuelo antispam
  const [startedAt] = useState(() => Date.now());

  // Guarda el correo en la tabla newsletter_subscribers (Supabase, con límite antispam en la base)
  const handleSubscribe = async (event) => {
    event.preventDefault();
    const form = event.target;
    setError('');
    if (looksLikeBot(trap, startedAt)) {
      if (!trap) setError('Un momento y vuelve a intentarlo.');
      return;
    }
    const email = new FormData(form).get('email');
    const { error: rpcError } = await supabase.rpc('subscribe_newsletter', { p_email: email });
    if (rpcError) {
      console.error(rpcError);
      setError('No pudimos suscribirte. Intenta de nuevo.');
      return;
    }
    setSubscribed(true);
    form.reset();
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
        <a href="#/admin">Administración</a>
      </div>

      <div className="footer__newsletter">
        <span>ÚNETE AL DROP</span>
        <p>{error || (subscribed ? '¡Listo! Te avisaremos del próximo drop.' : 'Acceso anticipado. Sin spam.')}</p>

        <form onSubmit={handleSubscribe}>
          <Honeypot value={trap} onChange={setTrap} />
          <input type="email" name="email" placeholder="TU EMAIL" aria-label="Correo electrónico" required />

          <button type="submit" aria-label="Suscribirme">→</button>
        </form>
      </div>
    </footer>
  );
}
