export default function Modal({ title, onClose, children }) {
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={onClose}>
      <div className="modal__box" onMouseDown={(event) => event.stopPropagation()}>
        <header className="modal__header">
          <h3>{title}</h3>
          <button type="button" aria-label="Cerrar" onClick={onClose}>×</button>
        </header>
        {children}
      </div>
    </div>
  );
}
