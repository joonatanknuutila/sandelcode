import { LoginScreen } from "@/components/LoginScreen";

// Front door. No passwords for the demo — pick a persona and the LoginScreen
// routes into that role's view. Real SSO (Entra ID, owned by Arttu) takes over
// here in production.
export default function Home() {
  return <LoginScreen />;
}
