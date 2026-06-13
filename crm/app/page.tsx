import { redirect } from "next/navigation";

// Default landing. Real SSO (Arttu) will route to the signed-in user's role
// home; until then the demo defaults to the Sales Rep view — the only role
// that creates data and our priority persona.
export default function Home() {
  redirect("/rep");
}
