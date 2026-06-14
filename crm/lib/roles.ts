// Role definitions and the default landing route per role. Role-based access:
// each role lands on its own default view (brief P0).

import { Role } from "./types";

export interface RoleConfig {
  role: Role;
  label: string;
  /** Default view this role lands on after login. */
  home: string;
  /** Sidebar navigation for this role. */
  nav: { label: string; href: string }[];
}

export const ROLES: Record<Role, RoleConfig> = {
  rep: {
    role: "rep",
    label: "Sales Rep",
    home: "/rep",
    nav: [
      { label: "Dashboard", href: "/rep" },
      { label: "Accounts", href: "/rep/accounts" },
      { label: "Inbox", href: "/rep/inbox" },
    ],
  },
  tam: {
    role: "tam",
    label: "Technical Account Manager",
    home: "/tam",
    nav: [
      { label: "My Cases", href: "/tam" },
      { label: "Accounts", href: "/tam/accounts" },
      { label: "Inbox", href: "/tam/inbox" },
      { label: "AI Assistant", href: "/tam/ai" },
      { label: "Integrations", href: "/tam/integrations" },
    ],
  },
  sm: {
    role: "sm",
    label: "Sales Manager",
    home: "/sm",
    nav: [
      { label: "Dashboard", href: "/sm" },
      { label: "Team Board", href: "/sm/pipeline" },
      { label: "Reports", href: "/sm/reports" },
      { label: "Accounts", href: "/sm/accounts" },
      { label: "Inbox", href: "/sm/inbox" },
    ],
  },
  finance: {
    role: "finance",
    label: "Finance",
    home: "/finance",
    nav: [
      { label: "Forecast", href: "/finance" },
      { label: "Pipeline", href: "/finance/pipeline" },
      { label: "Reports", href: "/finance/reports" },
      { label: "Accounts", href: "/finance/accounts" },
      { label: "Catalog", href: "/finance/catalog" },
      { label: "Inbox", href: "/finance/inbox" },
    ],
  },
};

export const ROLE_ORDER: Role[] = ["rep", "tam", "sm", "finance"];
