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
      { label: "My Accounts", href: "/rep/accounts" },
    ],
  },
  tam: {
    role: "tam",
    label: "Technical Account Manager",
    home: "/tam",
    nav: [{ label: "My Cases", href: "/tam" }],
  },
  sm: {
    role: "sm",
    label: "Sales Manager",
    home: "/sm",
    nav: [{ label: "Team Pipeline", href: "/sm" }],
  },
  finance: {
    role: "finance",
    label: "Finance",
    home: "/finance",
    nav: [{ label: "Forecast", href: "/finance" }],
  },
};

export const ROLE_ORDER: Role[] = ["rep", "tam", "sm", "finance"];
