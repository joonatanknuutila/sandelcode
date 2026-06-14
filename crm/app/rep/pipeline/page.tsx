import { redirect } from "next/navigation";

export default function RepPipelinePage() {
  redirect("/rep/accounts?view=kanban");
}
