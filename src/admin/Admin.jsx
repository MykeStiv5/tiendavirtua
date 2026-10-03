import { useEffect, useState } from 'react';
import { supabase, supabaseConfigured } from '../lib/supabase';
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
      // Si Supabase no responde en 15 s, avisamos en vez de quedarnos "pensando"
      await Promise.race([
        signIn(email, password),
        new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 15000)),
      ]);
    } catch (err) {
      console.error('[AREA 11] Error de login:', err);
      if (err.message === 'TIMEOUT') {
        setError('Supabase no responde. Revisa VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en tu archivo .env y reinicia npm run dev.');
      } else if (/invalid login credentials/i.test(err.message)) {
        setError('Correo o contraseña incorrectos.');
      } else {
        setError(err.message || 'No se pudo iniciar sesión.');
      }
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

        {!supabaseConfigured && (
          <p className="form-message form-message--error">
            Falta configurar Supabase: crea el archivo <strong>.env</strong> (copia de .env.example) con
            VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY, y reinicia <strong>npm run dev</strong>.
          </p>
        )}

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
