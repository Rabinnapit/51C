# Agent brief — CORB Prep App content work

Read this, then `app/docs/CONTRACT.md` sections 3, 7 and 8. Paths are relative to `C:\Users\rabin\Documents\Army\CORB\app`.

## What this is
A one-file offline study and board-support app for U.S. Army contracting professionals preparing for a
**Contracting Officer Review Board (CORB)** — the oral board a candidate passes to receive a warrant
(signatory authority) — and for the board members and facilitators who run those boards. Primary unit:
**411th Contracting Support Brigade (411th CSB), Republic of Korea**, under Army Contracting Command (ACC).
Other SCO sets in the bank: ACC-All, 409th CSB (Germany), USACE, USAMRAA, ACC-WRN, MICC.

## Regulatory context (as of 13 Sep 2026)
- The **Revolutionary FAR Overhaul (RFO)** rewrote and renumbered the FAR. Per Army Warranting Program
  Policy v12 (MAR 2026) it is effective in FAR/DFARS/AFARS from **1 Feb 2026**. Cite RFO numbering.
  Live source: https://www.acquisition.gov/far-overhaul (part deviation guides, crosswalks, model deviations).
  Examples seen in 411th study decks: ratification of unauthorized commitments = RFO FAR 1.405 (was 1.602-3);
  brand-name / limited competition = RFO FAR 6.103-1, approvals 6.104 (was 6.302-1, 6.304);
  restricting competition for commercial = 12.102; price analysis = 15.404-1; cure notice = 49.607;
  commercial terminations = 12.304; options = 17.204-1; protests = 33.104-3 / 33.105; changes = 43.301;
  personal services = 37.201-2; GFP liability = 52.245-1(h); COR designation = DFARS PGI 201.404-70(e).
  Do not trust these from memory — verify on acquisition.gov and record `confidence`.
- Warrant classes (Policy v12 Table 1): Class I = SAT; Class II = $500K, $1M, $5M, SaP;
  Class III = $10M, $25M, $50M, $100M; Class IV = $250M, $500M, Unlimited.
- Army warrant policy, ACC Contracting Note 26-03 (reciprocity), 411th workflow, VCE-Warrants guide, and the
  five study-group decks are in `content/sources/`. The question bank is `src/data/questions.json`.
- Korea specifics: Logistics Cost Sharing (LCS) under the Special Measures Agreement (SMA), ROK MND approves
  and awards LCS contracts, USFK J4 manages LCS, 411th KOs recommend award; SOFA Article XV Invited Contractor
  (IC) program via USFK/FKAQ, USFKI 4901.01; LCS competition limited to Korean firms; O&M and LCS cannot be
  mixed in one solicitation. Anything beyond what the sources say must be flagged `korea-verify-cp`.
- DAU course references in decks point to **waru.edu** (Acquipedia). Treat DAU/WARU naming as unverified;
  write "DAU (WARU) Acquipedia" until confirmed.

## Non-negotiable content rules
1. Never invent local 411th approval thresholds, names, or emails. Describe roles ("Chief, C&P", "CONOPS"). The developer and maintainer contact in `src/data/meta.json` is real and intentional; leave it in place.
2. Every drafted answer carries `flags: ["ai-drafted"]` and a `confidence` of high/medium/low with a reason.
3. Board-ready voice: answer the way a KO would say it aloud in 45–90 seconds, then a "Cite:" line.
   Plain text. Short paragraphs. Bullets as "- ". No markdown headers, no HTML, no tables.
4. Cite RFO numbering. When you convert an old cite, record `{old, new}` in `crosswalk`.
   If you cannot verify a new number, keep the old cite and set `rfo_status: "unverifiable"`.
5. Statutes (U.S.C., CFR) are unchanged by the RFO. DoDGARs (2 CFR / 32 CFR) govern grants/agreements.
6. Prefer fetching the actual acquisition.gov page over recollection. Record `source_url` where you fetched.
7. Output = a JSON file at the path your task names, valid UTF-8, and a short structured summary.
   Do not modify `src/data/questions.json` directly — the orchestrator merges.
8. Keep every item self-contained: a reader with no other context must be able to use it.
