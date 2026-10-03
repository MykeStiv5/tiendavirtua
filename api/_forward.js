// Hace el POST a https://api.mercadopago.com/checkout/preferences con el ACCESS TOKEN.
// Se ejecuta SIEMPRE en el servidor (función serverless o proxy de Vite en desarrollo).
export async function createPreference(body, token) {
  if (!token) {
    return { status: 500, data: { error: 'Falta MERCADOPAGO_ACCESS_TOKEN en el servidor' } };
  }

  const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));
  return { status: response.status, data };
}
