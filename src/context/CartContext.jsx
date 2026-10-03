import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'area11_cart_v1';
const CartContext = createContext(null);

function loadCart() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(loadCart);

  // Persistencia en localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* almacenamiento no disponible */
    }
  }, [items]);

  const value = useMemo(() => {
    const keyOf = (productId, size) => `${productId}__${size}`;

    return {
      items,
      count: items.reduce((sum, i) => sum + i.quantity, 0),
      subtotal: items.reduce((sum, i) => sum + i.price * i.quantity, 0),

      addItem(product, size, quantity = 1) {
        const key = keyOf(product.id, size);
        setItems((current) => {
          const existing = current.find((i) => i.key === key);
          if (existing) {
            return current.map((i) =>
              i.key === key ? { ...i, quantity: Math.min(i.quantity + quantity, product.stock) } : i,
            );
          }
          return [
            ...current,
            {
              key,
              productId: product.id,
              name: product.name,
              price: Number(product.price),
              image: product.image_url,
              stock: product.stock,
              size,
              quantity: Math.min(quantity, product.stock),
            },
          ];
        });
      },

      changeQuantity(key, delta) {
        setItems((current) =>
          current.map((i) =>
            i.key === key
              ? { ...i, quantity: Math.max(1, Math.min(i.quantity + delta, i.stock || 99)) }
              : i,
          ),
        );
      },

      removeItem(key) {
        setItems((current) => current.filter((i) => i.key !== key));
      },

      clear() {
        setItems([]);
      },
    };
  }, [items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => useContext(CartContext);
