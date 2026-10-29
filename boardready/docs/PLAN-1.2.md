# Board Ready 1.2 plan (29 October 2026)

Review of 1.1.1 before the move into the 51C repository, and what 1.2.0 changes. Written by the maintainer's assistant
from a code read, a browser run of every page (desktop and phone width) and a check of the official sources.

## What the review found

**Works well (keep).** Boot in under a second from a 4.5 MB file (DOMContentLoaded 550 ms, 13 MB of memory), no console
errors on any page, no horizontal overflow at 375 px, every button named for screen readers, one warrant class and one
organization setting that every page follows, answers hidden by default, Start-first setup pages, a balanced quiz bank
(1.1.1), the Arcade and the mock board.

**Gaps against the maintainer's other app (B2B Exam Prep) and the 2026 web.**

| Area | Gap in 1.1.1 | 1.2.0 |
|---|---|---|
| Delivery | Three HTML files and Word packages only; nothing a phone can install; no way to push a fix to everyone | A **web edition on GitHub Pages** (`rabinnapit.github.io/51C/boardready/`) that installs as an app on Android, iPhone and computers, works offline through a service worker, and offers a reload when a newer build is published. The files and Word packages stay, and the website offers them for download |
| Build and release | Built by hand on one computer; `dist/` and the Word packages committed nowhere | GitHub Actions builds every edition and the Word packages on each push to `main` (same workflow as B2B Exam Prep); `tools/check_content.py` runs first |
| Menu | The 256 px side menu cannot be collapsed on a laptop | Collapse to an icon rail (remembered), the same control as B2B |
| Reading | One text size; day/night only | Four text sizes; day, night or follow-the-device |
| Read-aloud | One voice picked by name; "KO" read as "ko", "15.404-1" as a decimal | B2B's read-aloud: the device's natural voices listed best first, contracting pronunciation (K O, core, dee-fars, fifteen point four oh four dash one), rise-and-fall delivery, Lively/Even tone |
| Accessibility | `#app` was `aria-live="polite"`: a screen reader announced every re-render | Live region moved to the toasts; skip link; focus moves to the page content on navigation |
| Dates | `next_board` was a fixed date (14 Oct 2026, already past) | The next board date is computed from the cadence (second Wednesday of the month) |
| Content | Verified 14 Sep 2026 | Re-checked 29 Oct 2026: see below |

## Content check, 29 October 2026

Sources opened: acquisition.gov/far-overhaul (page updated 26 Oct 2026), the DPCAP class deviations page (acq.osd.mil),
the Federal Register notices as reported by Wiley, Nextgov and Washington Technology, and the AFARS on acquisition.gov.

| Item | Finding | Change in 1.2.0 |
|---|---|---|
| FAR Overhaul status | Formal rulemaking: first proposed rules 23 Jun 2026 (20 parts), second batch 18 Sep 2026 (Parts 8, 9, 12, 13, 14, 15, 16, 17, 27, 28, 35, 36, 38, 44, 47, 51 plus Part 52 clauses; comments closed 19 Oct 2026). No final rule yet; agencies keep using the deviation text | "Where the overhaul stands" note in the Regulation explorer and the warrant-program primer, dated |
| Thresholds | MPT $15,000, SAT $350,000, TINA $10M (DoD, awards after 30 Jun 2026) unchanged. CAS applicability $35M and full coverage $100M took effect 1 Oct 2026; the $7.5M trigger is gone | Threshold rows reworded from "effective 1 Oct 2026" to "since 1 Oct 2026" |
| DoD class deviations | 2026-O0025 Rev 3 (3 Sep 2026, FAR Part 40 information and supply-chain security); 2024-O0006 Rev 2 (7 Oct 2026, Russian fossil fuel). Nothing new on warrants, J&A tiers, protests or debriefings | Noted in the overhaul note; no question changes |
| Army 8(a) policy | ASA(ALT) memorandum of 7 Apr 2026 (DASA(P)): competitive procedures are the preference over 8(a) sole source to the maximum extent practicable; small business sole source and set-aside awards above $20M get senior-level review | Added to the small-business primer and the glossary, flagged verify (secondary source; confirm the memo on PAM) |
| Department of War | The department's name since the September 2025 executive order; statutes and the DFARS title still say Defense | Glossary entry "DoW"; app text that speaks for itself says DoW; quoted answers unchanged |
| WarU | DAU became the Warfighting Acquisition University (waru.edu) | Resource titles and glossary say WarU (formerly DAU) |
| Army Warranting Program Policy, AFARS | Policy v12 (Mar 2026) still current as far as public sources show; the AFARS lives on PAM during the overhaul. PAM needs a CAC, so these are not re-verified here | Marked "verify on PAM" in the sources list |

## Not in 1.2.0 (follow-ups)

- Terms-of-use screen and owner notice like B2B Exam Prep (a product decision for the owner).
- A QR install sheet (`make_handout.py`) for Board Ready.
- Accounts and cloud progress sync (B2B has an optional Supabase account; Board Ready keeps progress on the device).
- Fusing B2B Exam Prep and Board Ready into one career-long guide (the long-term plan in B2B's CONTRACT.md).
