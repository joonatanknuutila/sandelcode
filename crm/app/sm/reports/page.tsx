import { Reports } from "@/components/Reports";

// Sales Manager — Basic reporting (brief P1). Deterministic, read-only; the
// shared Reports component does all the work and is mounted identically on
// /finance/reports.
export default function SmReportsPage() {
  return <Reports />;
}
