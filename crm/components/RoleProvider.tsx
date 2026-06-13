"use client";

// Holds the "logged-in" role for the demo. Real auth (Entra ID SSO, owned by
// Arttu) will set this from the signed-in user's claims; until then a switcher
// lets reviewers jump between the four role views. Persisted to localStorage so
// a refresh keeps you on your role.

import { createContext, useContext, useEffect, useState } from "react";
import { Role } from "@/lib/types";

interface RoleContextValue {
  role: Role;
  setRole: (role: Role) => void;
}

const RoleContext = createContext<RoleContextValue | null>(null);

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<Role>("rep");

  useEffect(() => {
    const saved = localStorage.getItem("hmd-crm-role") as Role | null;
    if (saved) setRoleState(saved);
  }, []);

  function setRole(next: Role) {
    setRoleState(next);
    localStorage.setItem("hmd-crm-role", next);
  }

  return (
    <RoleContext.Provider value={{ role, setRole }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole(): RoleContextValue {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used within RoleProvider");
  return ctx;
}
