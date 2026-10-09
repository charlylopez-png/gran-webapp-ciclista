import { countryIso } from "@/lib/competitions";

// Bandera real (imagen SVG vía la librería flag-icons) en vez de emoji:
// se ve igual en Windows, iPhone y Android, sin depender de que el
// sistema operativo tenga dibujos de bandera en su fuente de emoji.
export default function CountryFlag({
  team,
  className = "",
}: {
  team: string | null | undefined;
  className?: string;
}) {
  const iso = countryIso(team);
  if (!iso) return null;
  return <FlagIcon iso={iso} className={className} />;
}

// Bandera a partir del código ISO de 2 letras ('es', 'si'…), para los
// corredores que tienen la nacionalidad guardada (grandes vueltas).
export function FlagIcon({
  iso,
  className = "",
  title,
}: {
  iso: string | null | undefined;
  className?: string;
  title?: string;
}) {
  if (!iso || !/^[a-z]{2}$/.test(iso)) return null;
  return (
    <span
      className={`fi fi-${iso} shrink-0 rounded-[3px] align-[-1px] ${className}`}
      title={title}
      aria-hidden={title ? undefined : true}
    />
  );
}
