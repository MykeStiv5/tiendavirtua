import { useEffect } from 'react';
import { useHashRoute } from './hooks/useHashRoute';
import Announcement from './components/Announcement';
import Header from './components/Header';
import Footer from './components/Footer';
import Home from './pages/Home';
import ProductPage from './pages/ProductPage';
import Cart from './pages/Cart';
import Track from './pages/Track';
import Account from './pages/Account';
import Admin from './admin/Admin';

export default function App() {
  const { path, params, hash } = useHashRoute();

  // Scroll: a un ancla (#productos, #guia-tallas) o arriba al cambiar de página
  useEffect(() => {
    // #/hombre y #/mujer abren la tienda directo en el catálogo
    const isSection = path === '/hombre' || path === '/mujer';
    const id = hash && !hash.startsWith('#/') ? hash.slice(1) : isSection ? 'productos' : '';
    const frame = requestAnimationFrame(() => {
      const target = id && document.getElementById(id);
      if (target) target.scrollIntoView({ behavior: 'smooth' });
      else if (!id) window.scrollTo(0, 0);
    });
    return () => cancelAnimationFrame(frame);
  }, [path, hash]);

  // El panel admin va a pantalla completa (sin header/footer de la tienda)
  if (path.startsWith('/admin')) return <Admin />;

  let page;
  if (path === '/cart') page = <Cart params={params} />;
  else if (path === '/track') page = <Track params={params} />;
  else if (path === '/account') page = <Account />;
  else if (path.startsWith('/product/')) page = <ProductPage id={path.split('/')[2]} />;
  else if (path === '/hombre') page = <Home section="hombre" />;
  else if (path === '/mujer') page = <Home section="mujer" />;
  else page = <Home />;

  return (
    <>
      <Announcement />
      <Header />
      <main>{page}</main>
      <Footer />
    </>
  );
}
