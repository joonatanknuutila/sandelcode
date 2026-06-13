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
    const deal = {
      id, account_id: acc.id, name: `${device.name} rollout — ${acc.name}`, channel: acc.channel, stage,
      owner_rep_id: acc.owner_rep_id, currency: 'EUR', total_value_3yr_eur: 0,
      expected_close: iso(new Date(Date.now() + int(30, 480) * 864e5)).slice(0, 10),
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
  const acc = accounts.find((a) => a.id === deal.account_id);
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

const seed = { meta: { generated_at: iso(new Date()), win_probability: WINPCT, note: 'win% are assumptions pending HMD confirmation' }, users, accounts, contacts, products, services, deals, deal_forecast, offers, offer_lines, approvals, cases, case_notes, activities, notifications };

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'seed.json'), JSON.stringify(seed, null, 2));
for (const [k, v] of Object.entries(seed)) if (Array.isArray(v)) writeFileSync(join(OUT, `${k}.json`), JSON.stringify(v, null, 2));

const counts = Object.fromEntries(Object.entries(seed).filter(([, v]) => Array.isArray(v)).map(([k, v]) => [k, v.length]));
console.log('Seed generated ->', OUT);
console.table(counts);
