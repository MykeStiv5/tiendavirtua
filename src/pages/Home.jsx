import { useEffect, useMemo, useState } from 'react';
import ProductCard from '../components/ProductCard';
import { fetchCategories, fetchProducts } from '../services/catalog';
import { SECTIONS, SECTION_SLUGS } from '../config';

export default function Home({ section = 'all' }) {
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [activeSlug, setActiveSlug] = useState('all');
  const [status, setStatus] = useState('loading'); // loading | ready | error

  useEffect(() => {
    Promise.all([fetchCategories(), fetchProducts()])
      .then(([cats, prods]) => {
        setCategories(cats);
        setProducts(prods);
        setStatus('ready');
      })
      .catch((error) => {
        console.error(error);
        setStatus('error');
      });
  }, []);

  // Filtro dinámico por categoría
  // Hombre / Mujer ya no son categorías: son secciones (se eligen arriba)
  const typeCategories = useMemo(
    () => categories.filter((c) => !SECTION_SLUGS.includes(c.slug)),
    [categories],
  );

  const visibleProducts = useMemo(
    () =>
      products.filter(
        (p) =>
          (section === 'all' || (p.sections || []).includes(section)) &&
          (activeSlug === 'all' || p.categories?.slug === activeSlug),
      ),
    [products, section, activeSlug],
  );

  const sectionTitle = SECTIONS.find((s) => s.slug === section)?.label;

  return (
    <>
      {/* Hero */}
      <section className="hero">
        <img
          className="hero__image"
          src="https://images.unsplash.com/photo-1507553532144-b9df5e38c8d1?auto=format&fit=crop&w=1800&q=88"
          alt="Campaña de moda streetwear urbana"
        />

        <div className="hero__overlay"></div>

        <span className="hero__counter">01 / 04</span>

        <div className="hero__content">
          <span className="eyebrow eyebrow--light">DROP 04 — BOGOTÁ, 2025</span>

          <h1>
            FUERA DE<br />
            CONTEXTO.
          </h1>

          <p>Uniformes para una ciudad que nunca baja el ritmo.</p>

          <a href="#productos" className="button button--light">
            VER COLECCIÓN
            <span aria-hidden="true">→</span>
          </a>
        </div>
      </section>

      {/* Cinta */}
      <section className="ticker" aria-label="Características de la tienda">
        <span>HECHO EN COLOMBIA</span>
        <i>✦</i>
        <span>EDICIÓN LIMITADA</span>
        <i>✦</i>
        <span>ENVÍOS NACIONALES</span>
        <i>✦</i>
        <span>CAMBIOS FÁCILES</span>
      </section>

      {/* Catálogo */}
      <section className="section catalog" id="productos">
        <header className="section-heading">
          <div>
            <span className="eyebrow">DROP ACTUAL / 04</span>
            <h2>{sectionTitle ? sectionTitle.toUpperCase() : 'LO ÚLTIMO'}</h2>
          </div>

          <p>
            Piezas funcionales, siluetas amplias y materiales resistentes.
            Diseñado para moverse.
          </p>
        </header>

        <nav className="section-tabs" aria-label="Sección de la tienda">
          <a href="#/" className={`section-tab${section === 'all' ? ' section-tab--active' : ''}`}>
            TODO
          </a>
          {SECTIONS.map((s) => (
            <a
              key={s.slug}
              href={`#/${s.slug}`}
              className={`section-tab${section === s.slug ? ' section-tab--active' : ''}`}
            >
              {s.label.toUpperCase()}
            </a>
          ))}
        </nav>

        <nav className="categories" aria-label="Categorías de productos">
          <a
            href="#productos"
            className={`category${activeSlug === 'all' ? ' category--active' : ''}`}
            onClick={(event) => {
              event.preventDefault();
              setActiveSlug('all');
            }}
          >
            Todo
          </a>

          {typeCategories.map((category) => (
            <a
              key={category.id}
              href="#productos"
              className={`category${activeSlug === category.slug ? ' category--active' : ''}`}
              onClick={(event) => {
                event.preventDefault();
                setActiveSlug(category.slug);
              }}
            >
              {category.name}
            </a>
          ))}
        </nav>

        {status === 'loading' && <p className="state-message">Cargando productos…</p>}
        {status === 'error' && (
          <p className="state-message">
            No pudimos cargar el catálogo. Revisa tu conexión y la configuración de Supabase.
          </p>
        )}
        {status === 'ready' && visibleProducts.length === 0 && (
          <p className="state-message">No hay productos en esta categoría todavía.</p>
        )}

        <div className="product-grid">
          {visibleProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      {/* Editorial */}
      <section className="section editorial">
        <div className="editorial__image">
          <img
            src="https://images.unsplash.com/photo-1594035795389-9363dd86b113?auto=format&fit=crop&w=1400&q=88"
            alt="Editorial urbano de AREA 11"
          />

          <span>BOGOTÁ / 4°39'N</span>
        </div>

        <div className="editorial__content">
          <span className="eyebrow eyebrow--light">MANIFIESTO 001</span>

          <h2>LA CALLE NO PIDE PERMISO.</h2>

          <p>
            Diseñamos prendas que se sienten tan bien en movimiento como se
            ven en reposo. Sin temporadas. Sin ruido. Solo intención.
          </p>

          <a href="#/" className="text-link text-link--light">
            CONOCE LA HISTORIA
            <span aria-hidden="true">→</span>
          </a>
        </div>
      </section>
    </>
  );
}
