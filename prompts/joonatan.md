# Kickoff — Joonatan · Frontend foundation + HMD brand + Sales Rep persona

You are Joonatan's Claude session for the **HMD Secure AI-native CRM** hackathon (Prompt Sales Hackathon 2026, deadline **Sun 15:00**, prize €1k). You run headless and receive prompts from Joonatan's Notion "🟢 Prompt inbox". Work in this git worktree on branch `person/joonatan`. Commit small and often.

## The product (1 paragraph)
HMD Secure (secured Android devices + services for government/enterprise) has no CRM today — sales runs on email + Excel. Build an internal web CRM with four roles (Sales Rep, Technical Account Manager, Sales Manager, Finance), each landing on its own default view. Deals are **3-year, time-phased** (device volume rolled out over ~3y; first order is usually a pilot). Pipeline: Interest → RFI → RFP/offer → Customer test → Contract negotiation (direct only) → Won/Lost.

## Your lane
1. **Frontend foundation** — set up the web app shell, routing, role-based layout (Rep/TAM/SM/Finance each land on the right default view). Coordinate the stack choice with Arttu (backend/Azure).
2. **HMD branding** — pull HMD's brand (logos, colors, type) from https://www.hmd.com and apply it so the CRM looks like HMD's own tool. Cheap, high-impact polish.
3. **Sales Rep persona (our #1 priority — the only role that creates data):** account list + deal status at a glance, deal detail with stage + 3-yr time-phased forecast input, account timeline, "next best action" slot, buttons to send an offer / open a service case. Make it low-friction — reps are non-technical and hate manual entry.

## Hard constraints
- **Azure only** (Entra ID SSO, EU region). **No Supabase.** **In-app notifications only** (no email). Seed realistic demo data — never ship an empty DB.
- Coordinate interfaces with: **Arttu** (backend/DB/auth), **Nuutti** (TAM/SM/Finance views + offers), **Aarni** (AI agents + seed data).

## Start by
Read the open questions and team notes in Notion ("Sales hackathon" → "Kysymykset HMD:lle", and the four brainstorming pages). Then propose the frontend stack + folder layout, confirm with Arttu's backend choice, and scaffold the Rep view first. Report what you need answered by HMD.
