import { formatCOP, getBadge } from '../lib/format';

export default function ProductCard({ product }) {
  const badge = getBadge(product);
  const href = `#/product/${product.id}`;

  return (
    <article className="product-card">
      <a href={href} className="product-card__media">
        <img src={product.image_url} alt={product.name} loading="lazy" />

        {badge && (
          <span className={`badge${badge.warning ? ' badge--warning' : ''}`}>{badge.label}</span>
        )}
        <span className="quick-view">VER PRODUCTO</span>
      </a>

      <div className="product-card__content">
        <a href={href} className="product-card__name">
          {product.name.toUpperCase()}
        </a>

        <span className="product-card__category">{product.categories?.name}</span>

        <div className="product-card__footer">
          <strong>{formatCOP(product.price)}</strong>

          {/* Lleva a la ficha para elegir la talla antes de agregar */}
          <a href={href} className="add-button" aria-label={`Elegir talla de ${product.name}`}>
            +
          </a>
        </div>
      </div>
    </article>
  );
}
