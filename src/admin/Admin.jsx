import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { signIn, signOut, checkIsAdmin } from '../services/admin';
import AdminPanel from './AdminPanel';

export default function Admin() {
  const [session, setSession] = useState(undefined); // undefined = cargando
  const [isAdmin, setIsAdmin] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setIsAdmin(null);
      return;
    }
    checkIsAdmin(session.user.id).then(setIsAdmin);
  }, [session]);

  if (session === undefined || (session && isAdmin === null)) {
    return <div className="auth-screen"><p className="state-message">Cargando…</p></div>;
  }

  if (!session) return <LoginForm />;

  if (!isAdmin) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <h2>SIN PERMISOS</h2>
          <p>Esta cuenta no está registrada como administrador.</p>
          <button className="button button--dark button--full" type="button" onClick={signOut}>
            CERRAR SESIÓN
          </button>
        </div>
      </div>
    );
  }

  return <AdminPanel user={session.user} />;
}

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // onSubmit del formulario de acceso
  const handleSubmit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await signIn(email, password);
    } catch (err) {
      setError('Correo o contraseña incorrectos.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={handleSubmit}>
        <a href="#/" className="brand">
          <span>AREA</span>
          <strong>11</strong>
        </a>
        <h2>ADMIN SPACE</h2>

        <label className="field">
          <span>EMAIL</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />
        </label>

        <label className="field">
          <span>CONTRASEÑA</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
        </label>

        {error && <p className="form-message form-message--error">{error}</p>}

        <button className="button button--dark button--full" type="submit" disabled={busy}>
          {busy ? 'INGRESANDO…' : 'INGRESAR'}
        </button>
      </form>
    </div>
  );
}
