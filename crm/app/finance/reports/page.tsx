import { Reports } from "@/components/Reports";

// Finance — Basic reporting (brief P1). Deterministic, read-only; the shared
// Reports component does all the work and is mounted identically on
// /sm/reports.
export default function FinanceReportsPage() {
  return <Reports />;
}
