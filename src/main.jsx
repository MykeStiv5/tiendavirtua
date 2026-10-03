import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { CartProvider } from './context/CartContext';
import './styles/style.css'; // tu CSS original, sin cambios
import './styles/extra.css'; // estilos de elementos nuevos (formularios, modales, login)

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <CartProvider>
      <App />
    </CartProvider>
  </React.StrictMode>,
);
