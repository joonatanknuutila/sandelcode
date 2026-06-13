import { RolePlaceholder } from "@/components/RolePlaceholder";

export default function FinanceView() {
  return (
    <RolePlaceholder
      title="Forecast"
      owner="Nuutti"
      bullets={[
        "Weighted pipeline summary without asking sales",
        "Time-phased forecast across quarters over 3 years",
        "Filter by period, stage, deal size",
        "Export pipeline to Excel",
        "Maintain pricing catalog without a developer",
        "Second approval on discounted offers",
      ]}
    />
  );
}
