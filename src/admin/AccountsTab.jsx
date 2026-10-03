import { useCallback, useEffect, useState } from 'react';
import { callAdmin, fetchRecoveryRequests, resolveRecoveryRequest } from '../services/adminApi';
import { formatDateTime } from '../lib/format';

// Contraseña temporal legible (sin 0/O/1/l para evitar confusiones al dictarla por WhatsApp)
function tempPassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint32Array(10));
  return Array.from(bytes, (n) => chars[n % chars.length]).join('');
}

export default function AccountsTab({ onChange }) {
  const [requests, setRequests] = useState(null);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');

  const load = useCallback(async () => {
    try {
      setRequests(await fetchRecoveryRequests());
      setError('');
    } catch (err) {
      console.error(err);
      setError('No se pudieron cargar las solicitudes. ¿Ejecutaste supabase-migracion-3.sql?');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const afterReset = () => {
    load();
    onChange?.();
  };

  return (
    <>
      <section className="admin-panel">
        <header className="admin-panel__header">
          <div>
            <h3>SOLICITUDES DE RECUPERACIÓN</h3>
            <span>El cliente pide ayuda en la tienda y te escribe por WhatsApp</span>
          </div>
        </header>

        <p className="admin-note">
          <strong>Cómo se usa:</strong> 1) El cliente solicita la recuperación y te escribe por WhatsApp (también te
          llega un correo). 2) Confirma que es él (por ejemplo, que escriba desde el número de su pedido). 3) Genera
          una contraseña, pulsa <strong>CAMBIAR</strong> y cópiale el mensaje. Luego él puede cambiarla en Mi cuenta.
        </p>

        {error && <p className="form-message form-message--error">{error}</p>}
        {requests === null && !error && <p className="state-message">Cargando…</p>}
        {requests && requests.length === 0 && <p className="state-message">No hay solicitudes todavía.</p>}

        <div className="admin-table-wrapper">
          {requests && requests.length > 0 && (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>CORREO</th>
                  <th>FECHA</th>
                  <th>ESTADO</th>
                  <th>NUEVA CONTRASEÑA</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <RequestRow key={r.id} request={r} onDone={afterReset} />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="admin-panel" style={{ marginTop: 24 }}>
        <header className="admin-panel__header">
          <div>
            <h3>CAMBIAR CONTRASEÑA POR CORREO</h3>
            <span>Si el cliente te escribió sin haber solicitado nada en la tienda</span>
          </div>
        </header>
        <div className="admin-table-wrapper" style={{ padding: 16 }}>
          <label className="field" style={{ maxWidth: 360 }}>
            <span>CORREO DE LA CUENTA</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="cliente@correo.com" />
          </label>
          {email && <ResetControls email={email.trim()} onDone={afterReset} />}
        </div>
      </section>
    </>
  );
}

function RequestRow({ request, onDone }) {
  const pending = request.status === 'Pendiente';

  const handleResolve = async () => {
    try {
      await resolveRecoveryRequest(request.id);
      onDone();
    } catch (err) {
      alert('No se pudo marcar: ' + err.message);
    }
  };

  return (
    <tr>
      <td><strong>{request.email}</strong></td>
      <td>{formatDateTime(request.created_at)}</td>
      <td>
        <span className={`status ${pending ? 'status--low' : 'status--active'}`}>{request.status.toUpperCase()}</span>
      </td>
      <td>
        {pending ? (
          <>
            <ResetControls email={request.email} onDone={onDone} />
            <button type="button" className="table-action" style={{ marginTop: 8 }} onClick={handleResolve}>
              MARCAR RESUELTA SIN CAMBIAR
            </button>
          </>
        ) : (
          <span className="muted">{formatDateTime(request.resolved_at)}</span>
        )}
      </td>
    </tr>
  );
}

function ResetControls({ email, onDone }) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');
  const [error, setError] = useState('');

  const message = (pass) =>
    `Hola, ya recuperamos tu cuenta de AREA 11 ✅\nTu contraseña temporal es: ${pass}\nEntra en https://tiendavirtuafi.vercel.app/#/account con tu correo (${email}) y, si quieres, cámbiala en "Cambiar mi contraseña".`;

  const handleReset = async () => {
    setBusy(true);
    setError('');
    try {
      await callAdmin('reset-password', { email, password });
      setDone(password);
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message(done));
    } catch {
      window.prompt('Copia el mensaje:', message(done));
    }
  };

  if (done) {
    return (
      <div>
        <p className="form-message form-message--success" style={{ margin: '0 0 8px' }}>
          Contraseña cambiada ✓ — <strong>{done}</strong>
        </p>
        <button type="button" className="table-action" onClick={handleCopy}>
          COPIAR MENSAJE PARA WHATSAPP
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="table-actions">
        <input
          className="admin-select"
          placeholder="Mín. 8 caracteres"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button type="button" className="table-action" onClick={() => setPassword(tempPassword())}>
          GENERAR
        </button>
        <button type="button" className="table-action" disabled={busy || password.length < 8} onClick={handleReset}>
          {busy ? '…' : 'CAMBIAR'}
        </button>
      </div>
      {error && <p className="form-message form-message--error" style={{ margin: '8px 0 0' }}>{error}</p>}
    </div>
  );
}
