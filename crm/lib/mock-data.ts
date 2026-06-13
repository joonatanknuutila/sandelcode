// Frontend mock seed data so the Rep view is never empty during development.
// Aarni owns the real seed script (Azure DB); this exists only to render UI
// before the backend is wired. Everything here is shaped to `lib/types.ts`.

import {
  Account,
  Activity,
  AppNotification,
  Case,
  Contact,
  Deal,
  ForecastPoint,
  Offer,
  User,
} from "./types";

export const CURRENT_USER_ID = "u-rep-1";

export const users: User[] = [
  { id: "u-rep-1", name: "Joonatan Virtanen", email: "joonatan.virtanen@hmd.com", role: "rep", initials: "JV" },
  { id: "u-rep-2", name: "Liisa Korhonen", email: "liisa.korhonen@hmd.com", role: "rep", initials: "LK" },
  { id: "u-tam-1", name: "Mikael Aho", email: "mikael.aho@hmd.com", role: "tam", initials: "MA" },
  { id: "u-sm-1", name: "Sanna Niemi", email: "sanna.niemi@hmd.com", role: "sm", initials: "SN" },
  { id: "u-fin-1", name: "Petri Laine", email: "petri.laine@hmd.com", role: "finance", initials: "PL" },
];

export const accounts: Account[] = [
  {
    id: "a-1",
    name: "Bundeswehr Procurement Office",
    industry: "Defense",
    region: "DACH",
    channel: "direct",
    ownerId: "u-rep-1",
    tamId: "u-tam-1",
    website: "bundeswehr.de",
    summary: "Federal armed forces — secure handset rollout across 3 commands.",
  },
  {
    id: "a-2",
    name: "Helsinki University Hospital (HUS)",
    industry: "Healthcare",
    region: "Nordics",
    channel: "direct",
    ownerId: "u-rep-1",
    tamId: "u-tam-1",
    website: "hus.fi",
    summary: "Clinical staff devices with EU data-residency requirements.",
  },
  {
    id: "a-3",
    name: "Nordea Bank",
    industry: "Finance",
    region: "Nordics",
    channel: "direct",
    ownerId: "u-rep-1",
    website: "nordea.com",
    summary: "Investment-banking floor — secured comms pilot.",
  },
  {
    id: "a-4",
    name: "Statnett SF",
    industry: "Energy",
    region: "Nordics",
    channel: "reseller",
    ownerId: "u-rep-1",
    website: "statnett.no",
    summary: "Grid operator — field-engineer ruggedised fleet via reseller.",
  },
  {
    id: "a-5",
    name: "Ville de Lyon",
    industry: "Government",
    region: "France",
    channel: "direct",
    ownerId: "u-rep-1",
    tamId: "u-tam-1",
    website: "lyon.fr",
    summary: "Municipal government — phased device program for city services.",
  },
  {
    id: "a-6",
    name: "Maersk Group",
    industry: "Enterprise",
    region: "Nordics",
    channel: "direct",
    ownerId: "u-rep-2",
    website: "maersk.com",
    summary: "Logistics — port and vessel operations devices.",
  },
];

export const contacts: Contact[] = [
  { id: "c-1", accountId: "a-1", name: "Oberst Klaus Reinhardt", title: "Head of Procurement", email: "k.reinhardt@bundeswehr.de", primary: true },
  { id: "c-2", accountId: "a-1", name: "Maria Brandt", title: "IT Security Lead", email: "m.brandt@bundeswehr.de" },
  { id: "c-3", accountId: "a-2", name: "Dr. Anna Laaksonen", title: "CIO", email: "anna.laaksonen@hus.fi", primary: true },
  { id: "c-4", accountId: "a-3", name: "Erik Sundqvist", title: "Head of Security", email: "erik.sundqvist@nordea.com", primary: true },
  { id: "c-5", accountId: "a-5", name: "Camille Dubois", title: "DSI Adjointe", email: "c.dubois@lyon.fr", primary: true },
];

// Build a plausible 3-year ramp from a pilot to full rollout.
function ramp(
  pilotDevices: number,
  fullDevices: number,
  unitPrice: number,
  serviceMonthly: number,
): ForecastPoint[] {
  const points: ForecastPoint[] = [];
  for (let year = 0 as 0 | 1 | 2; year <= 2; year = (year + 1) as 0 | 1 | 2) {
    for (let quarter = 1 as 1 | 2 | 3 | 4; quarter <= 4; quarter = (quarter + 1) as 1 | 2 | 3 | 4) {
      const idx = year * 4 + (quarter - 1);
      // Pilot first 2 quarters, then linear ramp toward full volume.
      const progress = Math.min(1, idx / 8);
      const devices =
        idx < 2 ? Math.round(pilotDevices / 2) : Math.round(pilotDevices + (fullDevices - pilotDevices) * progress);
      points.push({
        year,
        quarter,
        devices,
        deviceRevenue: devices * unitPrice,
        // Monthly-recurring service revenue accrues on the active install base.
        serviceRevenue: Math.round(devices * serviceMonthly * 3),
      });
    }
  }
  return points;
}

function tcvOf(forecast: ForecastPoint[]): number {
  return forecast.reduce((sum, p) => sum + p.deviceRevenue + p.serviceRevenue, 0);
}

const f1 = ramp(500, 4000, 720, 12);
const f2 = ramp(200, 1500, 690, 14);
const f3 = ramp(80, 400, 850, 18);
const f4 = ramp(150, 900, 640, 10);
const f5 = ramp(120, 800, 700, 11);

export const deals: Deal[] = [
  {
    id: "d-1", accountId: "a-1", ownerId: "u-rep-1", name: "Bundeswehr secure handset program",
    stage: "contract_negotiation", channel: "direct", tcv: tcvOf(f1), forecast: f1,
    serviceModel: "monthly_recurring", expectedCloseDate: "2026-07-30",
    createdAt: "2026-02-10", updatedAt: "2026-06-11",
  },
  {
    id: "d-2", accountId: "a-2", ownerId: "u-rep-1", name: "HUS clinical device rollout",
    stage: "customer_test", channel: "direct", tcv: tcvOf(f2), forecast: f2,
    serviceModel: "fixed_term", expectedCloseDate: "2026-09-15",
    createdAt: "2026-03-01", updatedAt: "2026-06-09",
  },
  {
    id: "d-3", accountId: "a-3", ownerId: "u-rep-1", name: "Nordea trading-floor pilot",
    stage: "rfp", channel: "direct", tcv: tcvOf(f3), forecast: f3,
    serviceModel: "fixed_term", expectedCloseDate: "2026-10-01",
    createdAt: "2026-04-12", updatedAt: "2026-05-20",
  },
  {
    id: "d-4", accountId: "a-4", ownerId: "u-rep-1", name: "Statnett field-engineer fleet",
    stage: "customer_test", channel: "reseller", tcv: tcvOf(f4), forecast: f4,
    serviceModel: "one_off", expectedCloseDate: "2026-08-20",
    createdAt: "2026-03-22", updatedAt: "2026-06-12",
  },
  {
    id: "d-5", accountId: "a-5", ownerId: "u-rep-1", name: "Ville de Lyon city-services program",
    stage: "interest", channel: "direct", tcv: tcvOf(f5), forecast: f5,
    serviceModel: "monthly_recurring", expectedCloseDate: "2026-11-30",
    createdAt: "2026-05-28", updatedAt: "2026-05-28",
  },
];

export const cases: Case[] = [
  { id: "k-1", accountId: "a-1", title: "MDM enrollment failing on 40 units", serviceId: "s-mdm", priority: "high", status: "in_progress", assigneeId: "u-tam-1", createdAt: "2026-06-08", slaDueDate: "2026-06-14" },
  { id: "k-2", accountId: "a-2", title: "VPN profile push request", serviceId: "s-vpn", priority: "medium", status: "open", assigneeId: "u-tam-1", createdAt: "2026-06-11", slaDueDate: "2026-06-18" },
  { id: "k-3", accountId: "a-4", title: "Ruggedised case supplier delay (3rd party)", serviceId: "s-logistics", priority: "medium", status: "escalated", assigneeId: "u-tam-1", createdAt: "2026-06-02", escalatedToThirdParty: true },
];

export const activities: Activity[] = [
  { id: "ac-1", accountId: "a-1", dealId: "d-1", type: "meeting", authorId: "u-rep-1", body: "On-site security review with procurement + IT. Strong intent, pricing is the open item.", createdAt: "2026-06-11T10:00:00Z" },
  { id: "ac-2", accountId: "a-1", dealId: "d-1", type: "stage_change", authorId: "u-rep-1", body: "Moved to Contract negotiation.", createdAt: "2026-06-05T09:00:00Z" },
  { id: "ac-3", accountId: "a-2", dealId: "d-2", type: "call", authorId: "u-rep-1", body: "CIO confirmed pilot of 200 units for ICU + ER staff.", createdAt: "2026-06-09T14:30:00Z" },
  { id: "ac-4", accountId: "a-3", dealId: "d-3", type: "email", authorId: "u-rep-1", body: "Sent RFP response covering secured comms + compliance attestations.", createdAt: "2026-05-20T08:15:00Z" },
  { id: "ac-5", accountId: "a-5", dealId: "d-5", type: "note", authorId: "u-rep-1", body: "Inbound interest via gov procurement portal. Needs French data residency.", createdAt: "2026-05-28T12:00:00Z" },
];

export const offers: Offer[] = [
  {
    id: "o-1", accountId: "a-3", dealId: "d-3", version: 2, status: "pending_sm",
    lines: [
      { productId: "p-skyline-sec", name: "HMD Skyline Secure", quantity: 80, unitPrice: 850, discountPct: 12 },
      { productId: "s-mdm", name: "Secure MDM (fixed-term 3y)", quantity: 80, unitPrice: 216, discountPct: 0 },
    ],
    total: 77_184, justification: "Competitive displacement vs incumbent; 12% to win the pilot.",
    createdAt: "2026-05-21",
  },
];

export const notifications: AppNotification[] = [
  { id: "n-1", userId: "u-rep-1", body: "Your Nordea offer (v2) is awaiting Sales Manager approval.", href: "/rep/deals/d-3", read: false, createdAt: "2026-06-12T09:00:00Z" },
  { id: "n-2", userId: "u-rep-1", body: "Case 'MDM enrollment failing' on Bundeswehr is approaching its SLA.", href: "/rep/accounts/a-1", read: false, createdAt: "2026-06-12T11:30:00Z" },
  { id: "n-3", userId: "u-rep-1", body: "HUS deal hasn't been updated in 4 days.", href: "/rep/deals/d-2", read: true, createdAt: "2026-06-10T08:00:00Z" },
];
