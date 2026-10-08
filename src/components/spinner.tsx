// Circulito girando para los botones mientras esperan al servidor
// ("Guardando…", "Entrando…"). Toma el color del texto del botón.
export default function Spinner({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`tx-spinner ${className}`} />;
}
