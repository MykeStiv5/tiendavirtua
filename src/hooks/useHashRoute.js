import { useEffect, useState } from 'react';

/**
 * Router mínimo basado en hash.
 *   #/track?status=success&order_id=abc  ->  { path: '/track', params: URLSearchParams }
 *   #productos (ancla)                   ->  { path: '/' }   (la app hace scroll a #productos)
 */
function parse() {
  const hash = window.location.hash;
  if (!hash.startsWith('#/')) return { path: '/', params: new URLSearchParams(), hash };

  const [path, query = ''] = hash.slice(1).split('?');
  return { path: path || '/', params: new URLSearchParams(query), hash };
}

export function useHashRoute() {
  const [route, setRoute] = useState(parse);

  useEffect(() => {
    const onChange = () => setRoute(parse());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  return route;
}

export const navigate = (to) => {
  window.location.hash = to;
};
