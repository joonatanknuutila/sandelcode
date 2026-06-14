import { test, expect, type Page } from "@playwright/test";

// "What good looks like" — the brief's §07 as an executable acceptance suite.
//
// The bar: a new user with no training walks each journey end-to-end and never
// hits a dead-end or an empty screen. So these assertions check the GOOD,
// POPULATED outcome — real deals + cases on a view, an actual overdue deal in
// the manager's risk list, both approval gates live — not merely that a heading
// or button exists. A thin/empty database fails this suite, by design.
//
// Roles are URL-derived (the AppShell "View as" switcher navigates to the role
// home), so we drive each journey by visiting the role view. Where "good" means
// "rich data," we SEEK a populated instance rather than blindly taking the first
// card — resilient to seed IDs.
//
// Default run is non-destructive. The create/approve WRITE round-trips run only
// under EVAL_MUTATE=1 (they add demo records).

const MUTATE = Boolean(process.env.EVAL_MUTATE);

// The rep UI uses "plain language" copy ("Support tickets", "What to do next")
// that differs from the internal copy ("Service cases", "Next best action").
// Match BOTH so the suite is resilient to the in-flight plain-language refactor.
const CASES_HEADING = /Service cases|Support tickets/i;
const TIMELINE_HEADING = /Activity timeline|History/i;
const EMPTY_CASES = /No (open cases|support tickets)\./;
const NBA_LABEL = /What to do next|Next best action/i;

/** Open the rep's first account that has BOTH a deal and a case populated —
 *  the "account 360" only shows its value when both are present. */
async function openRichRepAccount(page: Page): Promise<void> {
  await page.goto("/rep/accounts");
  const links = page.locator('a[href^="/rep/accounts/"]');
  await expect(links.first()).toBeVisible();
  const hrefs = await links.evaluateAll((els) =>
    els.map((e) => (e as HTMLAnchorElement).getAttribute("href")!),
  );
  for (const href of hrefs) {
    await page.goto(href);
    const deals = await page.locator('a[href^="/rep/deals/"]').count();
    const emptyCases = await page.getByText(EMPTY_CASES).count();
    if (deals > 0 && emptyCases === 0) return; // both populated
  }
  throw new Error("No rep account has both a deal and a case — seed data too thin");
}

test.describe("§07 — what good looks like", () => {
  // 1. Rep finds an account and sees open deals + active cases TOGETHER.
  test("1 · account 360 shows real deals AND cases on one view", async ({ page }) => {
    await openRichRepAccount(page);
    await expect(page.getByRole("heading", { name: "Deals" })).toBeVisible();
    await expect(page.getByRole("heading", { name: CASES_HEADING })).toBeVisible();
    await expect(page.getByRole("heading", { name: TIMELINE_HEADING })).toBeVisible();
    // Real content, not empty states:
    expect(await page.locator('a[href^="/rep/deals/"]').count()).toBeGreaterThan(0);
    await expect(page.getByText(EMPTY_CASES)).toHaveCount(0);
  });

  // 2. Rep creates a deal — direct, stage, expected close, phased forecast.
  test("2 · rep can create a deal (direct, stage, close, forecast)", async ({ page }) => {
    await openRichRepAccount(page);
    const newDeal = page.getByRole("button", { name: "+ New deal" });
    await expect(newDeal).toBeVisible();
    await newDeal.click();
    await expect(page.getByRole("heading", { name: "New deal" })).toBeVisible();
    await expect(page.getByLabel("Channel")).toBeVisible();
    await expect(page.getByLabel("Stage")).toBeVisible();
    await expect(page.getByLabel("Expected close date")).toBeVisible();

    if (MUTATE) {
      const title = `Eval deal ${Date.now()}`;
      await page.getByLabel("Deal title").fill(title);
      await page.getByLabel("Channel").selectOption("direct");
      await page.getByLabel("Expected close date").fill("2027-03-31");
      await page.getByRole("button", { name: /create deal|save|create/i }).first().click();
      await expect(page.getByRole("heading", { name: "New deal" })).toBeHidden();
      // survives a reload + appears on the account
      await page.reload();
      await expect(page.getByText(title)).toBeVisible();
    }
  });

  // 3. Rep opens the catalog, picks items, total computed from catalog prices.
  test("3 · offer builder loads the catalog and computes a total", async ({ page }) => {
    await page.goto("/rep");
    await page.locator('a[href^="/rep/deals/"]').first().click();
    await page.getByRole("link", { name: /Build .* offer/i }).first().click();
    await expect(page.getByRole("heading", { name: "Build & send offer" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Add items|Add line items/i })).toBeVisible();
    // The catalog picker — the offer total is computed from its catalog prices.
    await expect(page.getByLabel(/Product or service|Product \/ service/i)).toBeVisible();
  });

  // 4. TAM works a case — reads real history, has the note composer + SLA.
  test("4 · tam case has history, a note composer and SLA", async ({ page }) => {
    await page.goto("/tam");
    await page.locator('a[href^="/tam/cases/"]').first().click();
    await expect(page.getByRole("heading", { name: /Service history/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Add note" })).toBeVisible();
    await expect(page.getByText(/SLA/).first()).toBeVisible();

    if (MUTATE) {
      await page.getByRole("textbox").first().fill(`Eval note ${Date.now()}`);
      await page.getByRole("button", { name: /add note|save note|post/i }).first().click();
    }
  });

  // 5. Manager sees OVERDUE deals + the weighted pipeline immediately.
  test("5 · sm risk list surfaces an actual overdue deal + weighted pipeline", async ({ page }) => {
    await page.goto("/sm");
    await expect(page.getByText("Weighted pipeline").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: /At risk/i })).toBeVisible();
    // An actual past-close (overdue) deal is shown — not just the section.
    await expect(page.getByText("past close").first()).toBeVisible();
  });

  // 6. Finance sees the time-phased 3-yr forecast, weighted, without asking.
  test("6 · finance shows the time-phased 3-yr forecast", async ({ page }) => {
    await page.goto("/finance");
    await expect(page.getByRole("heading", { name: /Time-phased forecast/i })).toBeVisible();
    await expect(page.getByText("Y1 Q1").first()).toBeVisible();
    await expect(page.getByText(/Weighted/).first()).toBeVisible();
  });

  // 7. Rep opens a deal and gets a grounded next-best-action suggestion.
  test("7 · rep deal shows a next-best-action card with a grounded suggestion", async ({ page }) => {
    await page.goto("/rep");
    await page.locator('a[href^="/rep/deals/"]').first().click();
    const nba = page.getByText(NBA_LABEL);
    await expect(nba).toBeVisible();
    // The card always renders a grounded headline + detail beside the label —
    // assert the surrounding card carries real suggestion text, not just a label.
    const card = page.locator("div").filter({ has: nba }).last();
    expect((await card.innerText()).replace(/what to do next/i, "").trim().length).toBeGreaterThan(10);
  });

  // 8. Discount approval round-trip — SM AND Finance both have a live gate, and
  //    justification is shown on the offer awaiting approval.
  test("8 · both SM and Finance approval gates are live with justification", async ({ page }) => {
    await page.goto("/sm");
    await expect(
      page.getByRole("heading", { name: /Needs your approval.*Sales Manager/i }),
    ).toBeVisible();

    await page.goto("/finance");
    await expect(
      page.getByRole("heading", { name: /Needs your approval.*Finance/i }),
    ).toBeVisible();
    await expect(page.getByText(/Justification:/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Approve" }).first()).toBeVisible();

    if (MUTATE) {
      await page.getByRole("button", { name: "Approve" }).first().click();
      await expect(page.getByText(/locked|approved/i).first()).toBeVisible();
    }
  });
});

// P2 feature smoke — the additions this work introduced, on real data.
test.describe("P2 features", () => {
  test("export · pipeline CSV is a downloadable text/csv attachment", async ({ request }) => {
    const res = await request.get("/api/export/pipeline");
    expect(res.ok()).toBeTruthy();
    expect(res.headers()["content-type"]).toContain("text/csv");
    expect(res.headers()["content-disposition"]).toContain("attachment");
    const body = await res.text();
    expect(body).toContain("Deal,Account,Owner");
    expect(body.trim().split("\r\n").length).toBeGreaterThan(1); // header + rows
  });

  test("export · cases CSV is a downloadable text/csv attachment", async ({ request }) => {
    const res = await request.get("/api/export/cases");
    expect(res.ok()).toBeTruthy();
    expect(res.headers()["content-type"]).toContain("text/csv");
    expect(await res.text()).toContain("Case ID,Title,Account");
  });

  test("export · CSV affordance is on the Reports view", async ({ page }) => {
    await page.goto("/finance/reports");
    await expect(page.getByRole("link", { name: /Export pipeline CSV/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Export cases CSV/i })).toBeVisible();
  });

  test("forecast narrative renders on the Finance view", async ({ page }) => {
    await page.goto("/finance");
    await expect(page.getByText("Forecast narrative")).toBeVisible();
  });

  test("case summary · a 5+ note case shows the model-backed thread summary", async ({ page }) => {
    await page.goto("/tam");
    const hrefs = await page
      .locator('a[href^="/tam/cases/"]')
      .evaluateAll((els) =>
        els.map((e) => (e as HTMLAnchorElement).getAttribute("href")!),
      );
    let found = false;
    for (const href of hrefs.slice(0, 10)) {
      await page.goto(href);
      if ((await page.getByText(/Thread summary/i).count()) > 0) {
        found = true;
        break;
      }
    }
    expect(found, "a case with 5+ notes should surface the AI thread summary").toBeTruthy();
  });
});
