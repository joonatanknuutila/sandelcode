import { Card } from "./ui";

// Placeholder for the TAM / Sales Manager / Finance views (Nuutti's lane).
// Establishes the route + role landing so the shell and role switcher work
// end-to-end; the real views drop in here.
export function RolePlaceholder({
  title,
  owner,
  bullets,
}: {
  title: string;
  owner: string;
  bullets: string[];
}) {
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <Card className="p-6">
        <p className="text-sm text-muted">
          This view is owned by <strong>{owner}</strong>. The route, role landing
          and app shell are wired — drop the real view in here.
        </p>
        <p className="mt-4 text-xs font-medium uppercase tracking-wide text-muted">
          Planned for this role
        </p>
        <ul className="mt-2 list-inside list-disc space-y-1 text-sm">
          {bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
