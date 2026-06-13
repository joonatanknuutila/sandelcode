import { RolePlaceholder } from "@/components/RolePlaceholder";

export default function SalesManagerView() {
  return (
    <RolePlaceholder
      title="Team pipeline"
      owner="Nuutti"
      bullets={[
        "Full team pipeline — deals by stage, value, owner",
        "Deals not moved in 14+ days",
        "Reassign deals/cases between reps/TAMs",
        "Quarter forecast: committed, at-risk, gap to target",
        "Approve / reject discounted offers",
      ]}
    />
  );
}
