import { RolePlaceholder } from "@/components/RolePlaceholder";

export default function TamView() {
  return (
    <RolePlaceholder
      title="My cases"
      owner="Nuutti"
      bullets={[
        "All assigned cases sorted by priority + age",
        "Full service history of an account on one timeline",
        "Escalation to 3rd party with status tracking",
        "SLA deadline warnings",
      ]}
    />
  );
}
