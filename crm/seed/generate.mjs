#!/usr/bin/env node
// HMD Secure CRM — deterministic seed-data generator (zero deps).
// Emits realistic gov/enterprise EU demo data matching ../SCHEMA.md.
// Usage: node crm/seed/generate.mjs   ->  writes crm/seed/out/seed.json + per-entity JSON
// Deterministic (seeded PRNG) so demos are stable across reruns.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'out');

// --- seeded PRNG (mulberry32) ---
let _s = 0x9e3779b9;
const rnd = () => { _s |= 0; _s = (_s + 0x6d2b79f5) | 0; let t = Math.imul(_s ^ (_s >>> 15), 1 | _s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const int = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
const chance = (p) => rnd() < p;
let _id = 0; const uid = (p) => `${p}_${(++_id).toString(36).padStart(4, '0')}`;
const iso = (d) => d.toISOString();
const daysAgo = (n) => new Date(Date.now() - n * 864e5);
const round2 = (n) => Math.round(n * 100) / 100;

// --- reference data ---
const STAGES = ['interest', 'rfi', 'rfp', 'customer_test', 'contract_negotiation', 'won', 'lost'];
const WINPCT = { interest: 10, rfi: 25, rfp: 40, customer_test: 60, contract_negotiation: 80, won: 100, lost: 0 };

const ACCOUNTS = [
  ['Bundesdruckerei GmbH', 'bundesdruckerei.de', 'DE', 'government', 'direct'],
  ['Finnish Defence Forces', 'puolustusvoimat.fi', 'FI', 'government', 'direct'],
  ['Gendarmerie Nationale', 'gendarmerie.fr', 'FR', 'government', 'direct'],
  ['Politiet', 'politiet.no', 'NO', 'government', 'reseller'],
  ['Belgian Federal Police', 'police.be', 'BE', 'government', 'direct'],
  ['Stadtwerke München', 'swm.de', 'DE', 'enterprise', 'direct'],
  ['Airbus Defence and Space', 'airbus.com', 'FR', 'enterprise', 'direct'],
  ['Thales Group', 'thalesgroup.com', 'FR', 'enterprise', 'reseller'],
  ['A.P. Moller - Maersk', 'maersk.com', 'DK', 'enterprise', 'direct'],
  ['Vattenfall AB', 'vattenfall.com', 'SE', 'enterprise', 'direct'],
  ['Deutsche Bahn AG', 'deutschebahn.com', 'DE', 'enterprise', 'reseller'],
  ['City of Helsinki', 'hel.fi', 'FI', 'government', 'direct'],
  ['Rijkswaterstaat', 'rws.nl', 'NL', 'government', 'direct'],
  ['Nokia Solutions', 'nokia.com', 'FI', 'enterprise', 'direct'],
];

const FIRST = ['Anna', 'Mikael', 'Sophie', 'Lars', 'Elena', 'Johan', 'Marie', 'Pekka', 'Henrik', 'Clara', 'Pierre', 'Ingrid', 'Tomas', 'Saara'];
const LAST = ['Virtanen', 'Schmidt', 'Dubois', 'Andersen', 'Rossi', 'Larsson', 'Janssen', 'Korhonen', 'Müller', 'Berg', 'Laurent', 'Nielsen', 'Novak', 'Aaltonen'];
const TITLES = ['CISO', 'Head of IT', 'Procurement Lead', 'Security Architect', 'Fleet Manager', 'IT Director', 'Mobility Lead'];

const PRODUCTS = [
  ['HMD-S30', 'HMD Secure S30', 'device', 749],
  ['HMD-X20', 'HMD Secure X20', 'device', 549],
  ['HMD-PPS', 'HMD Pulse Pro Secure', 'device', 899],
  ['HMD-T11', 'HMD Secure Tab 11', 'device', 649],
  ['HMD-RG2', 'HMD Rugged G2 Secure', 'device', 1099],
  ['ACC-DOCK', 'Secure Charging Dock', 'accessory', 89],
  ['ACC-CASE', 'Tamper-evident Case', 'accessory', 49],
];

const SERVICES = [
  ['SVC-MDM', 'HMD Mobile Device Management', 'internal', 'monthly_recurring', 6],   // per device / month
  ['SVC-OSU', 'Secure OS Update Subscription', 'internal', 'fixed_term', 120],        // per device / year
  ['SVC-MON', 'Security Monitoring (per device)', 'internal', 'monthly_recurring', 9],
  ['SVC-ONB', 'Fleet Onboarding & Provisioning', 'internal', 'one_off', 4500],
  ['SVC-TI', '3rd-party Threat Intelligence Feed', 'third_party', 'fixed_term', 18000],
  ['SVC-SOC', '3rd-party SOC Escalation', 'third_party', 'monthly_recurring', 14],
];

// --- users ---
const users = [];
const mk = (name, role) => { const id = uid('usr'); users.push({ id, name, email: `${name.toLowerCase().replace(/[^a-z]/g, '.')}@hmd-secure.com`, role }); return id; };
const reps = [mk('Aino Mäkinen', 'rep'), mk('David Kraus', 'rep'), mk('Camille Roy', 'rep')];
const tams = [mk('Niklas Holm', 'tam'), mk('Petra Vogel', 'tam')];
const sm = mk('Markus Lindqvist', 'sales_manager');
const fin = mk('Riikka Salo', 'finance');

// --- catalog ---
const products = PRODUCTS.map(([sku, name, category, p]) => ({ id: uid('prd'), sku, name, category, list_price_eur: p, active: true }));
const services = SERVICES.map(([sku, name, type, invoicing_model, p]) => ({ id: uid('svc'), sku, name, type, invoicing_model, unit_price_eur: p, active: true }));
const devices = products.filter((p) => p.category === 'device');

// --- accounts + contacts ---
const accounts = [], contacts = [];
for (const [name, domain, country, sector, channel] of ACCOUNTS) {
  const id = uid('acc');
  accounts.push({ id, name, domain, country, sector, channel, owner_rep_id: pick(reps), tam_id: pick(tams), created_at: iso(daysAgo(int(120, 540))) });
  const nc = int(2, 4);
  for (let i = 0; i < nc; i++) {
    const fn = pick(FIRST), ln = pick(LAST);
    contacts.push({ id: uid('con'), account_id: id, name: `${fn} ${ln}`, title: pick(TITLES), email: `${fn.toLowerCase()}.${ln.toLowerCase()}@${domain}`, phone: `+${int(30, 49)} ${int(10, 99)} ${int(1000000, 9999999)}`, is_primary: i === 0 });
  }
}

// --- deals + time-phased forecast ---
const deals = [], deal_forecast = [], activities = [];
const quarters = () => { const out = []; const now = new Date(); let y = now.getFullYear(), q = Math.floor(now.getMonth() / 3) + 1; for (let i = 0; i < 12; i++) { out.push(`${y}-Q${q}`); q++; if (q > 4) { q = 1; y++; } } return out; };
const QS = quarters();

for (const acc of accounts) {
  const nd = int(1, 2);
  for (let d = 0; d < nd; d++) {
    const stage = chance(0.15) ? 'won' : chance(0.12) ? 'lost' : pick(STAGES.slice(0, acc.channel === 'reseller' ? 4 : 5));
    const id = uid('deal');
    const totalUnits = int(200, 4000);
    const device = pick(devices);
    const createdAt = daysAgo(int(20, 300));
    const lastAct = daysAgo(stage === 'won' || stage === 'lost' ? int(10, 90) : int(1, 28)); // some stalled >14d
    const openStage = stage !== 'won' && stage !== 'lost';
    // ~1 in 4 open deals has slipped past its expected close — the "overdue"
    // deal-risk signal the Sales Manager needs to see (brief P1 / scenario 05).
    const closeOffsetDays = openStage && chance(0.25) ? -int(5, 70) : int(30, 480);
    const deal = {
      id, account_id: acc.id, name: `${device.name} rollout — ${acc.name}`, channel: acc.channel, stage,
      owner_rep_id: acc.owner_rep_id, currency: 'EUR', total_value_3yr_eur: 0,
      expected_close: iso(new Date(Date.now() + closeOffsetDays * 864e5)).slice(0, 10),
      created_at: iso(createdAt), last_activity_at: iso(lastAct), lost_reason: stage === 'lost' ? pick(['price', 'lost to incumbent', 'project cancelled', 'no budget']) : null,
    };
    // phase units across ~8 quarters (front-loaded pilot then ramp)
    let remaining = totalUnits, total = 0;
    const span = int(6, 10);
    for (let i = 0; i < span; i++) {
      const frac = i === 0 ? 0.12 : 0.10 + rnd() * 0.16;
      const units = i === span - 1 ? remaining : Math.min(remaining, Math.round(totalUnits * frac));
      remaining -= units; if (units <= 0) continue;
      const deviceRev = units * device.list_price_eur;
      const svcRev = units * (6 + 9) * 12 + (i === 0 ? 4500 : 0); // MDM+MON monthly *12 + onboarding in Q1
      total += deviceRev + svcRev;
      deal_forecast.push({ id: uid('fc'), deal_id: id, period: QS[i], device_units: units, device_revenue_eur: round2(deviceRev), service_revenue_eur: round2(svcRev) });
    }
    deal.total_value_3yr_eur = round2(total);
    deals.push(deal);
    activities.push({ id: uid('act'), account_id: acc.id, deal_id: id, case_id: null, type: 'stage_change', body: `Deal moved to ${stage}`, actor_id: acc.owner_rep_id, created_at: deal.last_activity_at });
    activities.push({ id: uid('act'), account_id: acc.id, deal_id: id, case_id: null, type: pick(['call', 'email', 'meeting']), body: pick(['Intro call with procurement', 'Sent RFI response', 'Pilot scoping workshop', 'Security architecture review', 'Pricing discussion']), actor_id: acc.owner_rep_id, created_at: iso(daysAgo(int(5, 60))) });
  }
}

// --- offers + lines + approvals ---
const offers = [], offer_lines = [], approvals = [];
for (const deal of deals.filter((d) => ['rfp', 'customer_test', 'contract_negotiation', 'won'].includes(d.stage)).slice(0, 8)) {
  const id = uid('off');
  const discount = pick([0, 0, 5, 10, 15, 22]);
  const status = discount === 0 ? 'approved' : discount > 20 ? 'pending_finance' : pick(['pending_sm', 'approved', 'rejected']);
  const dev = devices.find((p) => deal.name.startsWith(p.name));
  const qty = int(150, 1200);
  let total = 0;
  const lines = [];
  const addLine = (prod, svc, q, price) => { const lt = round2(q * price * (1 - discount / 100)); total += lt; lines.push({ id: uid('ol'), offer_id: id, product_id: prod, service_id: svc, qty: q, unit_price_eur: price, discount_pct: discount, line_total_eur: lt }); };
  addLine(dev.id, null, qty, dev.list_price_eur);
  const mdm = services.find((s) => s.sku === 'SVC-MDM');
  addLine(null, mdm.id, qty, mdm.unit_price_eur * 12);
  offers.push({ id, deal_id: deal.id, account_id: deal.account_id, version: 1, status, discount_pct: discount, justification: discount > 0 ? pick(['Strategic logo, multi-year commitment', 'Competitive pressure from incumbent', 'Volume above 1000 units']) : null, total_eur: round2(total), created_by: deal.owner_rep_id, created_at: iso(daysAgo(int(3, 40))) });
  offer_lines.push(...lines);
  if (status !== 'draft' && discount > 0) {
    approvals.push({ id: uid('apr'), offer_id: id, approver_role: 'sales_manager', approver_id: sm, decision: status === 'rejected' ? 'rejected' : 'approved', comment: null, decided_at: iso(daysAgo(int(1, 20))) });
    if (discount > 20 && status === 'approved') approvals.push({ id: uid('apr'), offer_id: id, approver_role: 'finance', approver_id: fin, decision: 'approved', comment: 'Margin acceptable', decided_at: iso(daysAgo(int(1, 10))) });
  }
  activities.push({ id: uid('act'), account_id: deal.account_id, deal_id: deal.id, case_id: null, type: 'offer', body: `Offer v1 created (${discount}% discount, ${status})`, actor_id: deal.owner_rep_id, created_at: iso(daysAgo(int(3, 40))) });
}

// --- cases + notes ---
const cases = [], case_notes = [];
const CASE_TITLES = ['MDM enrolment failing on S30 batch', 'OS update bricked 3 devices', 'Threat intel feed latency', 'Request: add geofencing policy', 'SOC escalation — suspicious traffic', 'Bulk provisioning slow', 'Tamper alert false positives'];
for (const acc of accounts) {
  const ncs = int(0, 3);
  for (let i = 0; i < ncs; i++) {
    const id = uid('cas');
    const svc = pick(services);
    const status = pick(['open', 'in_progress', 'escalated', 'resolved', 'closed']);
    const created = daysAgo(int(1, 40));
    const accContacts = contacts.filter((c) => c.account_id === acc.id);
    cases.push({
      id, account_id: acc.id, service_id: svc.id, title: pick(CASE_TITLES), type: chance(0.4) ? 'request' : 'complaint',
      status, priority: pick(['low', 'medium', 'high', 'urgent']), tam_id: acc.tam_id,
      customer_contact_id: pick(accContacts).id, sla_due_at: iso(new Date(created.getTime() + int(2, 7) * 864e5)),
      escalated_to_3p: status === 'escalated' && svc.type === 'third_party', created_at: iso(created),
      resolved_at: ['resolved', 'closed'].includes(status) ? iso(daysAgo(int(0, 5))) : null,
    });
    case_notes.push({ id: uid('cn'), case_id: id, author_id: acc.tam_id, body: pick(['Reproduced on test device, gathering logs', 'Escalated to vendor, ticket #' + int(1000, 9999), 'Workaround applied, monitoring', 'Awaiting customer confirmation']), kind: 'tech_working', created_at: iso(daysAgo(int(0, 10))) });
    if (chance(0.5)) case_notes.push({ id: uid('cn'), case_id: id, author_id: acc.owner_rep_id, body: 'FYI for the account — keep an eye on this before renewal talks.', kind: 'internal_sales', created_at: iso(daysAgo(int(0, 8))) });
    activities.push({ id: uid('act'), account_id: acc.id, deal_id: null, case_id: id, type: 'system', body: `Case opened: ${cases[cases.length - 1].title}`, actor_id: acc.tam_id, created_at: iso(created) });
  }
}

// --- notifications (in-app only) ---
const notifications = [];
for (const off of offers.filter((o) => o.status.startsWith('pending'))) {
  notifications.push({ id: uid('ntf'), user_id: off.status === 'pending_finance' ? fin : sm, type: 'approval_request', body: `Offer needs approval: ${off.discount_pct}% discount`, link_kind: 'offer', link_id: off.id, read: false, created_at: off.created_at });
}
for (const c of cases.filter((c) => c.priority === 'urgent' && c.status !== 'closed')) {
  notifications.push({ id: uid('ntf'), user_id: c.tam_id, type: 'sla_warning', body: `Urgent case approaching SLA: ${c.title}`, link_kind: 'case', link_id: c.id, read: false, created_at: iso(daysAgo(0)) });
}

// ---------------------------------------------------------------------------
// HERO NARRATIVE — deterministic, demo-critical. The randomised data above
// gives breadth; this gives the *story* the demo script walks through:
//   (1) one DIRECT account that runs the full lifecycle Interest → Won, with a
//       real stage-by-stage timeline, an approved offer (Rep→SM→Finance), and a
//       forecast that becomes committed at Won.
//   (2) one RESELLER deal (skips contract_negotiation per the model).
//   (3) a few cases on the hero account — incl. a 3rd-party SOC escalation and
//       dual-mode notes (internal_sales vs tech_working) — so Stage 4 "cases as
//       sales-risk" has something concrete.
// No PRNG here, so the hero is identical across reruns regardless of seed drift.
// ---------------------------------------------------------------------------
const at = (d) => iso(daysAgo(d));
const day = (d) => at(d).slice(0, 10);
const S30 = products.find((p) => p.sku === 'HMD-S30');
const svcOf = (sku) => services.find((s) => s.sku === sku);
const heroRep = reps[0], heroTam = tams[0];

// (1) Direct lifecycle account ------------------------------------------------
const hAcc = uid('acc');
accounts.push({ id: hAcc, name: 'Bundespolizei (Federal Police)', domain: 'bundespolizei.de', country: 'DE', sector: 'government', channel: 'direct', owner_rep_id: heroRep, tam_id: heroTam, created_at: at(248) });
const hC1 = uid('con'), hC2 = uid('con');
contacts.push({ id: hC1, account_id: hAcc, name: 'Klara Müller', title: 'CISO', email: 'klara.muller@bundespolizei.de', phone: '+49 30 1234567', is_primary: true });
contacts.push({ id: hC2, account_id: hAcc, name: 'Henrik Berg', title: 'Procurement Lead', email: 'henrik.berg@bundespolizei.de', phone: '+49 30 7654321', is_primary: false });

const hDeal = uid('deal');
// 3-yr time-phased forecast — pilot then ramp to ~8000 units.
const HUNITS = [600, 800, 1000, 1200, 1200, 1100, 1000, 1100];
let hTotal = 0;
HUNITS.forEach((units, i) => {
  const deviceRev = units * S30.list_price_eur;
  const svcRev = units * (6 + 9) * 12 + (i === 0 ? 4500 : 0); // MDM+MON monthly*12 + onboarding in Q1
  hTotal += deviceRev + svcRev;
  deal_forecast.push({ id: uid('fc'), deal_id: hDeal, period: QS[i], device_units: units, device_revenue_eur: round2(deviceRev), service_revenue_eur: round2(svcRev) });
});
deals.push({ id: hDeal, account_id: hAcc, name: 'HMD Secure S30 rollout — Bundespolizei', channel: 'direct', stage: 'won', owner_rep_id: heroRep, currency: 'EUR', total_value_3yr_eur: round2(hTotal), expected_close: day(6), created_at: at(248), last_activity_at: at(6), lost_reason: null });

// The lifecycle timeline (Interest → Won), every transition + colour around it.
const tl = [
  [245, 'note', 'Inbound interest via federal procurement portal — secure handset replacement programme across 3 commands.', heroRep],
  [244, 'stage_change', 'Deal moved to interest', heroRep],
  [232, 'call', 'Qualification call with CISO Klara Müller — driver is post-incident hardening + EU data residency.', heroRep],
  [210, 'email', 'Sent RFI response covering Secure OS, MDM, SOC escalation and compliance attestations.', heroRep],
  [206, 'stage_change', 'Deal moved to rfi', heroRep],
  [178, 'meeting', 'RFP scoping workshop with procurement + IT security. Scoped 2,000-unit pilot then ramp.', heroRep],
  [165, 'stage_change', 'Deal moved to rfp', heroRep],
  [120, 'meeting', 'Pilot kickoff — 2,000 S30 units provisioned for Command-1.', heroTam],
  [112, 'stage_change', 'Deal moved to customer_test', heroRep],
  [58, 'meeting', 'Commercial terms + 3-yr pricing review with Sales Manager and Finance.', heroRep],
  [46, 'stage_change', 'Deal moved to contract_negotiation', heroRep],
  [14, 'meeting', 'Final terms agreed; framework signed for 8,000 units over 3 years.', heroRep],
  [6, 'stage_change', 'Deal moved to won', heroRep],
];
for (const [d, type, body, actor] of tl) {
  activities.push({ id: uid('act'), account_id: hAcc, deal_id: hDeal, case_id: null, type, body, actor_id: actor, created_at: at(d) });
}

// Offer + approval workflow (Rep → SM → Finance) — the crown-jewel demo.
const hOff = uid('off');
const hQty = 2000, hDisc = 12;
const mdm = svcOf('SVC-MDM');
const lDev = round2(hQty * S30.list_price_eur * (1 - hDisc / 100));
const lMdm = round2(hQty * mdm.unit_price_eur * 12 * (1 - hDisc / 100));
offers.push({ id: hOff, deal_id: hDeal, account_id: hAcc, version: 2, status: 'approved', discount_pct: hDisc, justification: 'Strategic federal logo; competitive displacement of incumbent; 3-yr commitment above 1,000 units.', total_eur: round2(lDev + lMdm), created_by: heroRep, created_at: at(160) });
offer_lines.push({ id: uid('ol'), offer_id: hOff, product_id: S30.id, service_id: null, qty: hQty, unit_price_eur: S30.list_price_eur, discount_pct: hDisc, line_total_eur: lDev });
offer_lines.push({ id: uid('ol'), offer_id: hOff, product_id: null, service_id: mdm.id, qty: hQty, unit_price_eur: round2(mdm.unit_price_eur * 12), discount_pct: hDisc, line_total_eur: lMdm });
approvals.push({ id: uid('apr'), offer_id: hOff, approver_role: 'sales_manager', approver_id: sm, decision: 'approved', comment: 'Strategic; back this.', decided_at: at(150) });
approvals.push({ id: uid('apr'), offer_id: hOff, approver_role: 'finance', approver_id: fin, decision: 'approved', comment: 'Margin holds at 12%; committed to forecast.', decided_at: at(146) });
activities.push({ id: uid('act'), account_id: hAcc, deal_id: hDeal, case_id: null, type: 'offer', body: `Offer v2 approved (12% discount) — €${Math.round(lDev + lMdm).toLocaleString()}`, actor_id: heroRep, created_at: at(150) });

// (1b) Open EXPANSION deal on the hero account — so the default rep's showcase
// account has a LIVE deal to work (open deals + active cases together, scenario
// 01), it has slipped past its close date (overdue risk for the SM, scenario
// 05), and it carries a discounted offer still sitting at the Sales-Manager gate
// (so the SM→Finance approval walkthrough has a real item to act on, scenario 08).
const hExp = uid('deal');
const EUNITS = [400, 500, 600, 700];
let eTotal = 0;
EUNITS.forEach((units, i) => {
  const deviceRev = units * S30.list_price_eur;
  const svcRev = units * (6 + 9) * 12 + (i === 0 ? 4500 : 0);
  eTotal += deviceRev + svcRev;
  deal_forecast.push({ id: uid('fc'), deal_id: hExp, period: QS[i], device_units: units, device_revenue_eur: round2(deviceRev), service_revenue_eur: round2(svcRev) });
});
// expected_close 12 days ago + open stage => overdue; last activity 18 days ago => also stalled.
deals.push({ id: hExp, account_id: hAcc, name: 'HMD Secure S30 expansion — Bundespolizei (Command-2)', channel: 'direct', stage: 'contract_negotiation', owner_rep_id: heroRep, currency: 'EUR', total_value_3yr_eur: round2(eTotal), expected_close: day(12), created_at: at(70), last_activity_at: at(18), lost_reason: null });
activities.push({ id: uid('act'), account_id: hAcc, deal_id: hExp, case_id: null, type: 'stage_change', body: 'Deal moved to contract_negotiation', actor_id: heroRep, created_at: at(24) });
activities.push({ id: uid('act'), account_id: hAcc, deal_id: hExp, case_id: null, type: 'meeting', body: 'Command-2 expansion scoped — 2,200 units; pricing under review with procurement.', actor_id: heroRep, created_at: at(18) });

// Discounted offer on the expansion, still awaiting the Sales Manager (gate 1).
const hOff2 = uid('off');
const eQty = 2200, eDisc = 15;
const eDev = round2(eQty * S30.list_price_eur * (1 - eDisc / 100));
const eMdm = round2(eQty * mdm.unit_price_eur * 12 * (1 - eDisc / 100));
offers.push({ id: hOff2, deal_id: hExp, account_id: hAcc, version: 1, status: 'pending_sm', discount_pct: eDisc, justification: 'Command-2 expansion on the existing federal framework; 15% matches the incumbent renewal price and locks the 3-yr volume.', total_eur: round2(eDev + eMdm), created_by: heroRep, created_at: at(3) });
offer_lines.push({ id: uid('ol'), offer_id: hOff2, product_id: S30.id, service_id: null, qty: eQty, unit_price_eur: S30.list_price_eur, discount_pct: eDisc, line_total_eur: eDev });
offer_lines.push({ id: uid('ol'), offer_id: hOff2, product_id: null, service_id: mdm.id, qty: eQty, unit_price_eur: round2(mdm.unit_price_eur * 12), discount_pct: eDisc, line_total_eur: eMdm });
activities.push({ id: uid('act'), account_id: hAcc, deal_id: hExp, case_id: null, type: 'offer', body: `Offer v1 submitted — ${eDisc}% discount, pending Sales Manager`, actor_id: heroRep, created_at: at(3) });
notifications.push({ id: uid('ntf'), user_id: sm, type: 'approval_request', body: `Offer needs approval: ${eDisc}% discount — Bundespolizei expansion`, link_kind: 'offer', link_id: hOff2, read: false, created_at: at(3) });

// Cases on the hero account (Stage 4 — cases as sales-risk) -------------------
const mkCase = (svcSku, title, type, status, prio, created, esc, resolved) => {
  const id = uid('cas');
  cases.push({ id, account_id: hAcc, service_id: svcOf(svcSku).id, title, type, status, priority: prio, tam_id: heroTam, customer_contact_id: hC1, sla_due_at: iso(new Date(daysAgo(created).getTime() + 3 * 864e5)), escalated_to_3p: esc, created_at: at(created), resolved_at: resolved == null ? null : at(resolved) });
  activities.push({ id: uid('act'), account_id: hAcc, deal_id: null, case_id: id, type: 'system', body: `Case opened: ${title}`, actor_id: heroTam, created_at: at(created) });
  return id;
};
const ca1 = mkCase('SVC-MDM', 'MDM enrolment failing on S30 batch (Command-2)', 'complaint', 'resolved', 'high', 95, false, 88);
case_notes.push({ id: uid('cn'), case_id: ca1, author_id: heroTam, body: 'Root cause: APNs token issued on wrong tenant during migration. Re-issued for Command-2; all 40 units re-enrolled.', kind: 'tech_working', created_at: at(90) });
case_notes.push({ id: uid('cn'), case_id: ca1, author_id: heroRep, body: 'Resolved cleanly before the pilot review — good story for the contract conversation.', kind: 'internal_sales', created_at: at(89) });
const ca2 = mkCase('SVC-SOC', 'SOC escalation — anomalous traffic from 6 devices', 'complaint', 'escalated', 'urgent', 2, true, null);
case_notes.push({ id: uid('cn'), case_id: ca2, author_id: heroTam, body: 'Escalated to 3rd-party SOC (ticket #7741). Devices quarantined; awaiting threat-intel confirmation. Vendor SLA 48h.', kind: 'tech_working', created_at: at(1) });
case_notes.push({ id: uid('cn'), case_id: ca2, author_id: heroRep, body: 'Live account — keep this tight, renewal talks start next quarter.', kind: 'internal_sales', created_at: at(1) });
const ca3 = mkCase('SVC-MDM', 'Request: add geofencing policy for border units', 'request', 'in_progress', 'medium', 9, false, null);
// A deliberately long thread (5+ notes) so the model-backed case summary is
// demonstrable — below this threshold only the deterministic headline shows.
case_notes.push({ id: uid('cn'), case_id: ca3, author_id: heroTam, body: 'Requirement intake: border units need device lockdown when leaving designated operational zones. Confirmed scope covers 220 S30 handsets.', kind: 'tech_working', created_at: at(9) });
case_notes.push({ id: uid('cn'), case_id: ca3, author_id: heroTam, body: 'Drafting geofencing profile; pending customer confirmation of zones.', kind: 'tech_working', created_at: at(7) });
case_notes.push({ id: uid('cn'), case_id: ca3, author_id: heroRep, body: 'Customer flagged this as a gating item for the 3-yr renewal — worth getting right.', kind: 'internal_sales', created_at: at(6) });
case_notes.push({ id: uid('cn'), case_id: ca3, author_id: heroTam, body: 'Tested profile on 5 pilot devices; lock/unlock at zone boundary works. Battery impact within tolerance.', kind: 'tech_working', created_at: at(3) });
case_notes.push({ id: uid('cn'), case_id: ca3, author_id: heroTam, body: 'Awaiting customer reply on the final coordinate set for the eastern border zone before fleet-wide rollout. Are the published zones final?', kind: 'tech_working', created_at: at(1) });
notifications.push({ id: uid('ntf'), user_id: heroTam, type: 'sla_warning', body: `Urgent case approaching SLA: SOC escalation — anomalous traffic from 6 devices`, link_kind: 'case', link_id: ca2, read: false, created_at: at(0) });

// (2) Reseller deal (skips contract_negotiation) -----------------------------
const rAcc = uid('acc');
accounts.push({ id: rAcc, name: 'Forsvaret (Norwegian Armed Forces) — via Atea', domain: 'forsvaret.no', country: 'NO', sector: 'government', channel: 'reseller', owner_rep_id: reps[1], tam_id: tams[1], created_at: at(150) });
const rC1 = uid('con');
contacts.push({ id: rC1, account_id: rAcc, name: 'Lars Andersen', title: 'Head of IT', email: 'lars.andersen@forsvaret.no', phone: '+47 23 100200', is_primary: true });
const rDeal = uid('deal');
const RUNITS = [300, 450, 600, 700, 700, 650];
let rTotal = 0;
RUNITS.forEach((units, i) => {
  const deviceRev = units * S30.list_price_eur;
  const svcRev = units * (6 + 9) * 12 + (i === 0 ? 4500 : 0);
  rTotal += deviceRev + svcRev;
  deal_forecast.push({ id: uid('fc'), deal_id: rDeal, period: QS[i], device_units: units, device_revenue_eur: round2(deviceRev), service_revenue_eur: round2(svcRev) });
});
deals.push({ id: rDeal, account_id: rAcc, name: 'HMD Secure S30 fleet — Forsvaret (reseller: Atea)', channel: 'reseller', stage: 'customer_test', owner_rep_id: reps[1], currency: 'EUR', total_value_3yr_eur: round2(rTotal), expected_close: day(-40), created_at: at(150), last_activity_at: at(9), lost_reason: null });
for (const [d, type, body] of [
  [148, 'note', 'Reseller Atea registered the opportunity — field-ops fleet refresh.'],
  [146, 'stage_change', 'Deal moved to interest'],
  [120, 'email', 'RFI answered via Atea; HMD provided security architecture pack.'],
  [116, 'stage_change', 'Deal moved to rfi'],
  [70, 'meeting', 'Offer presented through Atea; reseller margin agreed.'],
  [64, 'stage_change', 'Deal moved to rfp'],
  [20, 'meeting', 'Customer test underway — 300-unit pilot with field units.'],
  [12, 'stage_change', 'Deal moved to customer_test'],
]) {
  activities.push({ id: uid('act'), account_id: rAcc, deal_id: rDeal, case_id: null, type, body, actor_id: reps[1], created_at: at(d) });
}

const seed = { meta: { generated_at: iso(new Date()), win_probability: WINPCT, note: 'win% are assumptions pending HMD confirmation', hero: { direct_account_id: hAcc, direct_deal_id: hDeal, reseller_deal_id: rDeal } }, users, accounts, contacts, products, services, deals, deal_forecast, offers, offer_lines, approvals, cases, case_notes, activities, notifications };

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'seed.json'), JSON.stringify(seed, null, 2));
for (const [k, v] of Object.entries(seed)) if (Array.isArray(v)) writeFileSync(join(OUT, `${k}.json`), JSON.stringify(v, null, 2));

const counts = Object.fromEntries(Object.entries(seed).filter(([, v]) => Array.isArray(v)).map(([k, v]) => [k, v.length]));
console.log('Seed generated ->', OUT);
console.table(counts);
