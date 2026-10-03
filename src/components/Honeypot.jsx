// Campo invisible para personas. Los bots suelen rellenar todos los inputs que ven en el HTML.
export default function Honeypot({ value, onChange }) {
  return (
    <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden' }}>
      <label>
        No llenar este campo
        <input
          type="text"
          name="company_url"
          tabIndex={-1}
          autoComplete="off"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
    </div>
  );
}
