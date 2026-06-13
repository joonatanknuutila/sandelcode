"use server";

// Read-only Server Action backing the ⌘K command bar (SearchCommand).
// Takes a raw query, runs the role-scoped cross-entity search, and returns the
// grouped hits. No mutations, so no revalidatePath — the scoping + current-user
// resolution all happen inside searchAll (lib/db/search).

import { searchAll, type SearchResults } from "@/lib/db/search";

export async function searchAction(query: string): Promise<SearchResults> {
  return searchAll(query);
}
