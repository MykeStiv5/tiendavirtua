import { useEffect, useState } from 'react';
import { useCart } from '../context/CartContext';
import { fetchProduct } from '../services/catalog';
import { formatCOP } from '../lib/format';
import { navigate } from '../hooks/useHashRoute';

// Enlace que se comparte: /p/<id> (api/share.js) trae foto, nombre y precio para el preview de WhatsApp, etc.
const shareUrl = (product) => `${window.location.origin}/p/${product.id}`;

const SIZE_GUIDE = [
  ['S', '92–96', '76–80', '68'],
  ['M', '97–102', '81–86', '70'],
  ['L', '103–108', '87–92', '72'],
  ['XL', '109–116', '93–100', '74'],
];

export default function ProductPage({ id }) {
  const { addItem } = useCart();
  const [product, setProduct] = useState(undefined); // undefined = cargando, null = no existe
  const [size, setSize] = useState('');
  const [color, setColor] = useState('');
  const [imgIndex, setImgIndex] = useState(0);
  const [message, setMessage] = useState('');
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setProduct(undefined);
    setSize('');
    setColor('');
    setImgIndex(0);
    setMessage('');
    setShareOpen(false);
    fetchProduct(id)
      .then(setProduct)
      .catch((error) => {
        console.error(error);
        setProduct(null);
      });
  }, [id]);

  if (product === undefined) {
    return <section className="section"><p className="state-message">Cargando producto…</p></section>;
  }
  if (product === null) {
    return (
      <section className="section">
        <p className="state-message">Este producto no existe.</p>
        <a href="#productos" className="button button--dark">VOLVER AL CATÁLOGO</a>
      </section>
    );
  }

  const soldOut = product.stock <= 0;
  const colors = product.colors || [];

  // Galería: product.images (la primera es la principal); los productos antiguos solo tienen image_url
  const gallery = product.images?.length ? product.images : product.image_url ? [product.image_url] : [];
  const activeIndex = Math.min(imgIndex, Math.max(gallery.length - 1, 0));
  const goTo = (delta) => setImgIndex((activeIndex + delta + gallery.length) % gallery.length);
  const pad = (n) => String(n).padStart(2, '0');
  // La guía de medidas (pecho/cintura/largo) solo aplica a ropa; en tenis (36, 37…) se oculta
  const isClothing = product.sizes.some((s) => ['S', 'M', 'L', 'XL'].includes(String(s).toUpperCase()));

  // Valida talla y agrega a la bolsa. Devuelve true si se agregó.
  const handleAdd = () => {
    if (soldOut) return false;
    if (!size) {
      setMessage('Selecciona una talla para continuar.');
      return false;
    }
    if (colors.length > 0 && !color) {
      setMessage('Selecciona un color para continuar.');
      return false;
    }
    addItem(product, size, 1, color);
    setMessage('Producto agregado a tu bolsa ✓');
    return true;
  };

  const handleBuyNow = () => {
    if (handleAdd()) navigate('/cart');
  };

  const shareText = `${product.name} — ${formatCOP(product.price)} | AREA 11`;

  // En celular abre el menú nativo de compartir; en escritorio despliega las opciones
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: product.name, text: shareText, url: shareUrl(product) });
        return;
      } catch (error) {
        if (error?.name === 'AbortError') return; // la persona canceló
      }
    }
    setShareOpen((open) => !open);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl(product));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copia este enlace:', shareUrl(product));
    }
  };

  return (
    <>
      {/* Detalle de producto */}
      <section className="section product-detail" id="detalle-producto">
        <div className="product-detail__gallery">
          <img src={gallery[activeIndex]} alt={`${product.name}, foto ${activeIndex + 1}`} />

          {gallery.length > 1 && (
            <>
              <button type="button" className="gallery-arrow gallery-arrow--prev" aria-label="Foto anterior" onClick={() => goTo(-1)}>‹</button>
              <button type="button" className="gallery-arrow gallery-arrow--next" aria-label="Foto siguiente" onClick={() => goTo(1)}>›</button>

              <div className="gallery-thumbs">
                {gallery.map((url, index) => (
                  <button
                    key={`${url}-${index}`}
                    type="button"
                    className={index === activeIndex ? 'is-active' : ''}
                    aria-label={`Ver foto ${index + 1}`}
                    onClick={() => setImgIndex(index)}
                  >
                    <img src={url} alt="" />
                  </button>
                ))}
              </div>
            </>
          )}

          <span className="product-detail__count">{pad(activeIndex + 1)} / {pad(Math.max(gallery.length, 1))}</span>
        </div>

        <div className="product-detail__content">
          <span className="eyebrow">{(product.categories?.name || 'AREA 11').toUpperCase()} / DROP 04</span>

          <h2>{product.name.toUpperCase()}</h2>

          <strong className="product-price">{formatCOP(product.price)}</strong>

          <p className="product-description">{product.description}</p>

          <div className="selector-heading">
            <span>SELECCIONA TU TALLA</span>
            {isClothing && <a href="#guia-tallas">GUÍA DE TALLAS</a>}
          </div>

          <div className="size-selector">
            {product.sizes.map((s) => (
              <span key={s} style={{ display: 'contents' }}>
                <input
                  type="radio"
                  name="size"
                  id={`size-${s}`}
                  checked={size === s}
                  onChange={() => {
                    setSize(s);
                    setMessage('');
                  }}
                />
                <label htmlFor={`size-${s}`}>{s}</label>
              </span>
            ))}
          </div>

          {colors.length > 0 && (
            <>
              <div className="selector-heading">
                <span>SELECCIONA TU COLOR</span>
              </div>

              <div className="color-selector">
                {colors.map((c, i) => (
                  <span key={c} style={{ display: 'contents' }}>
                    <input
                      type="radio"
                      name="color"
                      id={`color-${i}`}
                      checked={color === c}
                      onChange={() => {
                        setColor(c);
                        setMessage('');
                      }}
                    />
                    <label htmlFor={`color-${i}`}>{c.toUpperCase()}</label>
                  </span>
                ))}
              </div>
            </>
          )}

          {message && (
            <p className={`form-message${message.includes('✓') ? ' form-message--success' : ' form-message--error'}`}>
              {message}
            </p>
          )}

          <button
            type="button"
            className="button button--dark button--full"
            disabled={soldOut}
            onClick={handleAdd}
          >
            {soldOut ? 'AGOTADO' : 'AÑADIR A LA BOLSA'}
          </button>

          <button
            type="button"
            className="button button--outline button--full"
            disabled={soldOut}
            onClick={handleBuyNow}
          >
            COMPRAR AHORA
          </button>

          <button type="button" className="button button--outline button--full" onClick={handleShare}>
            COMPARTIR ↗
          </button>

          {shareOpen && (
            <div className="share-row">
              <a
                className="table-action"
                href={`https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl(product)}`)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                WHATSAPP
              </a>
              <a
                className="table-action"
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl(product))}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                FACEBOOK
              </a>
              <a
                className="table-action"
                href={`https://x.com/intent/post?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl(product))}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                X
              </a>
              <button type="button" className="table-action" onClick={handleCopy}>
                {copied ? 'COPIADO ✓' : 'COPIAR ENLACE'}
              </button>
            </div>
          )}

          <details className="accordion">
            <summary>¿Quienes Somos?</summary>
            <p>
              Nacimos en Bogotá con una misión clara: acercar las mejores tendencias de la moda urbana y los pares más buscados de streetwear a las calles de Colombia.
              Creemos que unos buenos tenis y las prendas indicadas no son solo ropa; son una forma de expresión, actitud e identidad. Por eso, nos encargamos de seleccionar minuciosamente cada modelo de nuestro catálogo, garantizando calidad, estilo y los acabados que te mereces.
              Trabajamos día a día para brindarte una experiencia de compra rápida, transparente y segura, con envío directo a tu puerta.
            </p>
          </details>

          <details className="accordion">
            <summary>ENVÍOS Y CAMBIOS</summary>
            <p>
              Envíos nacionales de 2 a 5 días hábiles. Cambios disponibles
              durante los primeros 15 días.
            </p>
          </details>
        </div>
      </section>

      {/* Guía de tallas (solo ropa) */}
      {isClothing && (
      <section className="section size-guide" id="guia-tallas">
        <header className="section-heading section-heading--compact">
          <div>
            <span className="eyebrow">ENCUENTRA TU FIT</span>
            <h2>GUÍA DE TALLAS</h2>
          </div>

          <p>
            Las medidas están expresadas en centímetros y corresponden a
            medidas aproximadas de la prenda.
          </p>
        </header>

        <div className="size-table-wrapper">
          <table className="size-table">
            <thead>
              <tr>
                <th>TALLA</th>
                <th>PECHO</th>
                <th>CINTURA</th>
                <th>LARGO</th>
              </tr>
            </thead>

            <tbody>
              {SIZE_GUIDE.map(([label, chest, waist, length]) => (
                <tr key={label}>
                  <th>{label}</th>
                  <td>{chest}</td>
                  <td>{waist}</td>
                  <td>{length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      )}
    </>
  );
}