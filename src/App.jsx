import { useEffect } from 'react';
import { useHashRoute } from './hooks/useHashRoute';
import Announcement from './components/Announcement';
import Header from './components/Header';
import Footer from './components/Footer';
import Home from './pages/Home';
import ProductPage from './pages/ProductPage';
import Cart from './pages/Cart';
import Track from './pages/Track';
import Admin from './admin/Admin';

export default function App() {
  const { path, params, hash } = useHashRoute();

  // Scroll: a un ancla (#productos, #guia-tallas) o arriba al cambiar de página
  useEffect(() => {
    const id = hash && !hash.startsWith('#/') ? hash.slice(1) : '';
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
  else if (path.startsWith('/product/')) page = <ProductPage id={path.split('/')[2]} />;
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
