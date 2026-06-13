export default function Home() {
  const roles = [
    { name: "Sales Rep", desc: "Accounts, pipeline, offers — the only role that creates data.", owner: "Joonatan" },
    { name: "Technical Account Manager", desc: "Cases by priority + age, service history, SLA awareness.", owner: "Nuutti" },
    { name: "Sales Manager", desc: "Team pipeline, stalled deals, forecast, discount approvals.", owner: "Nuutti" },
    { name: "Finance", desc: "Weighted 3-yr time-phased forecast, pricing catalog.", owner: "Nuutti" },
  ];

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <p className="text-sm font-medium uppercase tracking-widest text-neutral-500">
        HMD Secure · Prompt Sales Hackathon 2026
      </p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight">AI-native CRM</h1>
      <p className="mt-4 text-lg text-neutral-600 dark:text-neutral-300">
        One place for every account, case, and deal — with AI agents that make it feel
        less like data entry and more like having an analyst on the team.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {roles.map((r) => (
          <div
            key={r.name}
            className="rounded-xl border border-neutral-200 p-5 dark:border-neutral-800"
          >
            <h2 className="font-semibold">{r.name}</h2>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{r.desc}</p>
            <p className="mt-3 text-xs text-neutral-400">owner: {r.owner}</p>
          </div>
        ))}
      </div>

      <p className="mt-10 text-sm text-neutral-500">
        Scaffold live. Supabase wired (project <code>xwsmovmtfymiqvgjicfk</code>, eu-north-1).
        Next: Azure migration per brief · auth · role-based views · seed data.
      </p>
    </main>
  );
}
