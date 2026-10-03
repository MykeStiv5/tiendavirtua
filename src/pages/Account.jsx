import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  signUpBuyer,
  signInBuyer,
  signOutBuyer,
  fetchMyOrders,
  requestRecovery,
  changePassword,
} from '../services/account';
import { formatCOP, formatDateTime } from '../lib/format';
import { looksLikeBot } from '../lib/antispam';
import Honeypot from '../components/Honeypot';
import { FLOW_STATUSES, WHATSAPP_NUMBER } from '../config';

const STEPS = ['RECIBIDO', 'PAGADO', 'ENVIADO', 'ENTREGADO'];

export default function Account() {
  const [session, setSession] = useState(undefined); // undefined = cargando

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return (
      <section className="section">
        <p className="state-message">Cargando…</p>
      </section>
    );
  }

  return session ? <Orders user={session.user} /> : <AuthForm />;
}

function AuthForm() {
  const [mode, setMode] = useState('login'); // login | register | recover
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [trap, setTrap] = useState(''); // campo señuelo antispam
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [recovered, setRecovered] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const onField = (event) => setForm({ ...form, [event.target.name]: event.target.value });

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');

    // Antispam: un bot rellena el campo oculto o envía el formulario en milisegundos
    if (mode !== 'login' && looksLikeBot(trap, startedAt)) {
      if (trap) return; // bot: se ignora en silencio
      setError('Espera un par de segundos e inténtalo de nuevo.');
      return;
    }

    setBusy(true);
    try {
      if (mode === 'recover') {
        await requestRecovery({ email: form.email, honeypot: trap, startedAt });
        setRecovered(true);
      } else if (mode === 'register') {
        const { session } = await signUpBuyer(form);
        if (!session) setNotice('Te enviamos un correo para confirmar tu cuenta. Confírmalo y luego ingresa.');
      } else {
        await signInBuyer(form.email, form.password);
      }
    } catch (err) {
      console.error(err);
      if (/invalid login credentials/i.test(err.message)) setError('Correo o contraseña incorrectos.');
      else if (/already registered/i.test(err.message)) setError('Ese correo ya tiene una cuenta. Ingresa.');
      else if (/email not confirmed/i.test(err.message)) setError('Primero confirma tu correo (revisa tu bandeja).');
      else if (/password/i.test(err.message)) setError('La contraseña debe tener al menos 6 caracteres.');
      else setError(err.message || 'No se pudo continuar. Intenta de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  const isRegister = mode === 'register';
  const isRecover = mode === 'recover';

  const switchMode = (next) => {
    setMode(next);
    setError('');
    setNotice('');
    setRecovered(false);
    setStartedAt(Date.now());
  };

  const recoverMessage = `Hola AREA 11, no puedo entrar a mi cuenta. Mi correo registrado es ${form.email}. ¿Me ayudan a recuperarla?`;
  const recoverUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(recoverMessage)}`;

  if (isRecover) {
    return (
      <section className="section" style={{ display: 'grid', placeItems: 'center' }}>
        <form className="auth-card" onSubmit={handleSubmit}>
          <span className="eyebrow">MI CUENTA</span>
          <h2>RECUPERAR CUENTA</h2>

          {recovered ? (
            <>
              <p className="form-message form-message--success">
                Listo, ya le avisamos al equipo. Para confirmar que eres tú, escríbenos por WhatsApp desde el
                botón verde y te asignamos una contraseña nueva.
              </p>
              <a className="button button--green button--full" href={recoverUrl} target="_blank" rel="noopener noreferrer">
                ESCRIBIR POR WHATSAPP
              </a>
            </>
          ) : (
            <>
              <p style={{ marginBottom: 18 }}>
                Escribe el correo de tu cuenta. Te pediremos confirmar por WhatsApp y nosotros cambiamos tu
                contraseña.
              </p>
              <Honeypot value={trap} onChange={setTrap} />
              <label className="field">
                <span>EMAIL DE TU CUENTA</span>
                <input name="email" type="email" value={form.email} onChange={onField} required autoComplete="email" />
              </label>

              {error && <p className="form-message form-message--error">{error}</p>}

              <button className="button button--dark button--full" type="submit" disabled={busy}>
                {busy ? 'ENVIANDO…' : 'SOLICITAR RECUPERACIÓN'}
              </button>
            </>
          )}

          <p style={{ marginTop: 18 }}>
            <a href="#/account" onClick={(e) => { e.preventDefault(); switchMode('login'); }}>
              <strong>← Volver a ingresar</strong>
            </a>
          </p>
        </form>
      </section>
    );
  }

  return (
    <section className="section" style={{ display: 'grid', placeItems: 'center' }}>
      <form className="auth-card" onSubmit={handleSubmit}>
        <span className="eyebrow">MI CUENTA</span>
        <h2>{isRegister ? 'CREAR CUENTA' : 'INGRESAR'}</h2>

        {isRegister && <Honeypot value={trap} onChange={setTrap} />}

        {isRegister && (
          <label className="field">
            <span>NOMBRE COMPLETO</span>
            <input name="name" value={form.name} onChange={onField} required autoComplete="name" />
          </label>
        )}

        <label className="field">
          <span>EMAIL</span>
          <input name="email" type="email" value={form.email} onChange={onField} required autoComplete="email" />
        </label>

        <label className="field">
          <span>CONTRASEÑA</span>
          <input
            name="password"
            type="password"
            value={form.password}
            onChange={onField}
            required
            minLength={6}
            autoComplete={isRegister ? 'new-password' : 'current-password'}
          />
        </label>

        {error && <p className="form-message form-message--error">{error}</p>}
        {notice && <p className="form-message form-message--success">{notice}</p>}

        <button className="button button--dark button--full" type="submit" disabled={busy}>
          {busy ? 'UN MOMENTO…' : isRegister ? 'CREAR CUENTA' : 'INGRESAR'}
        </button>

        {!isRegister && (
          <p style={{ marginTop: 14 }}>
            <a href="#/account" onClick={(e) => { e.preventDefault(); switchMode('recover'); }}>
              ¿Olvidaste tu contraseña? <strong>Recupérala por WhatsApp</strong>
            </a>
          </p>
        )}

        <p style={{ marginTop: 18 }}>
          {isRegister ? '¿Ya tienes cuenta? ' : '¿Primera vez aquí? '}
          <a href="#/account" onClick={(e) => { e.preventDefault(); switchMode(isRegister ? 'login' : 'register'); }}>
            <strong>{isRegister ? 'Ingresa' : 'Crea tu cuenta'}</strong>
          </a>
        </p>
      </form>
    </section>
  );
}

function Orders({ user }) {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchMyOrders(user.id)
      .then(setOrders)
      .catch((err) => {
        console.error(err);
        setError('No pudimos cargar tus pedidos. Intenta de nuevo.');
      });
  }, [user.id]);

  return (
    <section className="tracking" style={{ display: 'block' }}>
      <div className="tracking__intro">
        <span className="eyebrow">MI CUENTA</span>
        <h2>MIS PEDIDOS</h2>
        <p>{user.user_metadata?.name ? `${user.user_metadata.name} · ` : ''}{user.email}</p>
        <button className="button button--dark" type="button" onClick={signOutBuyer}>
          CERRAR SESIÓN
        </button>
      </div>

      <PasswordChange />

      {error && <p className="form-message form-message--error">{error}</p>}
      {orders === null && !error && <p className="state-message">Cargando pedidos…</p>}
      {orders && orders.length === 0 && (
        <div className="empty-state">
          <p className="state-message">Aún no tienes pedidos.</p>
          <a href="#productos" className="button button--dark">VER COLECCIÓN</a>
        </div>
      )}

      {orders && orders.map((order) => <OrderCard key={order.id} order={order} />)}
    </section>
  );
}

function OrderCard({ order }) {
  const currentIndex = FLOW_STATUSES.indexOf(order.status); // -1 si es Abandonado / Reembolsado
  const refunded = order.status === 'Reembolsado';
  const abandoned = order.status === 'Abandonado';

  return (
    <div className="tracking-result" style={{ marginTop: 24 }}>
      <header className="tracking-result__header">
        <div>
          <span>PEDIDO</span>
          <strong>{order.order_code}</strong>
        </div>
        <div>
          <span>GUÍA DE ENVÍO</span>
          <strong>{order.tracking_guide || 'PENDIENTE'}</strong>
        </div>
        <span className="order-status">{order.status.toUpperCase()}</span>
      </header>

      <div style={{ padding: '16px 0' }}>
        {order.order_items.map((item, index) => (
          <p key={index} className="muted">
            {item.quantity}× {item.products?.name || 'Producto'} (talla {item.size}) — {formatCOP(item.price * item.quantity)}
          </p>
        ))}
        <p className="muted">
          Envío: {Number(order.shipping_cost) > 0 ? formatCOP(order.shipping_cost) : 'Gratis'}
        </p>
        <p><strong>Total: {formatCOP(order.total)}</strong> · {formatDateTime(order.created_at)}</p>
      </div>

      {refunded && (
        <p className="form-message">
          Este pedido fue reembolsado{order.refunded_at ? ` el ${formatDateTime(order.refunded_at)}` : ''}.
          {order.refund_note ? ` ${order.refund_note}` : ''} Si no ves el dinero, escríbenos por WhatsApp.
        </p>
      )}
      {abandoned && (
        <p className="form-message">
          El pago de este pedido no se completó. Si todavía lo quieres, vuelve a la bolsa o escríbenos por WhatsApp.
        </p>
      )}

      {!refunded && !abandoned && (
      <div className="steps">
        {STEPS.map((label, index) => {
          const completed = index <= currentIndex;
          let detail = 'PENDIENTE';
          if (index === 0) detail = formatDateTime(order.created_at);
          else if (index === currentIndex) detail = formatDateTime(order.updated_at);
          else if (completed) detail = 'COMPLETADO';

          return (
            <div key={label} className={`step${completed ? ' step--completed' : ''}`}>
              <i>{completed ? '✓' : index + 1}</i>
              <strong>{label}</strong>
              <span>{detail}</span>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}

function PasswordChange() {
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setMessage({ type: '', text: '' });
    try {
      await changePassword(password);
      setPassword('');
      setMessage({ type: 'success', text: 'Contraseña actualizada ✓' });
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: err.message || 'No se pudo cambiar la contraseña.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <details className="accordion" style={{ marginTop: 24 }}>
      <summary>CAMBIAR MI CONTRASEÑA</summary>
      <form onSubmit={handleSubmit} style={{ paddingTop: 12, maxWidth: 360 }}>
        <label className="field">
          <span>NUEVA CONTRASEÑA (mín. 6 caracteres)</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
            autoComplete="new-password"
          />
        </label>
        {message.text && <p className={`form-message form-message--${message.type}`}>{message.text}</p>}
        <button className="button button--dark" type="submit" disabled={busy}>
          {busy ? 'GUARDANDO…' : 'GUARDAR CONTRASEÑA'}
        </button>
      </form>
    </details>
  );
}
