# Sources (checked 22 October 2026; class materials, exam path and official documents checked 28 October 2026)

Everything in B2B Guide 0.9.0 comes from these public sources. Official WarU material from the maintainer, when it
arrives, should be checked against this list and take precedence.

## Certification

| Fact used in the guide | Source |
|---|---|
| Certification = CON 1100/1100V, 1200V, 1300V, 1400V, 7300V + CON 3990V exam + 12 months full-time experience; no education requirement for the certification; 80 CL hours / 2 years | WarU iCatalog, Contracting Professional certification standard, https://icatalog.waru.edu/CertificationStandard?cfld=3&lvl=4 |
| CON 7300V mandatory from 1 Oct 2026, after CON 1300V; components decide for people already in progress | Memo "Contracting Functional Area Certification Change for Fiscal Year 2027", J. Tenaglia, PD DPCAP, 5 Jun 2026, https://www.acq.osd.mil/dpap/policy/policyvault/USA001296-26-DPCAP.pdf |
| Course lengths, delivery, prerequisites (CON 1300V needs FAC 069, 082, 085 before and CON 0074, 0470 before or during), CON 1100 at 4 days during RFO rulemaking, CON 1400V RFO content from 11 May 2026, CON 7300V schedule | WarU iCatalog course pages (icatalog.waru.edu/CourseDetail/…) 12495 CON 1100V, 12501 CON 1200V, 12526 CON 1300V, 12565 CON 7300V, 12527 CON 1400V, 13346 CON 0074, 12833 CON 3910, 12539 CON 3900V, 12540 CON 3990V |
| Exam: 150 questions, 3 hours, 70%, closed book, Pearson test center or OnVUE (+4% at centers), FY26 average 74.8% and 79% first-try pass, 3 attempts / 12 months / 30 days, CON 3900V after a first failure, blueprint question counts, 20 FAR part titles, read Part 15, WarU pays, grace period 3 years and how it resets | DoW Contracting Professional Certification Exam FAQs (as of 1 Oct 2026), https://www.acq.osd.mil/asda/dpc/cp/policy/docs/wd/CON_Certification_Exam_FAQs_(As_of_01_Oct_2026).pdf |
| Exam registration steps: TAS (AITAS for Army) -> supervisor and training-approver approval -> ATRRS -> Pearson Authorization to Test within 24 hours -> schedule within 90 days -> 48-hour cancel rule, no-show counts, score report by four areas, no exam certificate | CON 3990V User Experience Roadmap (11 May 2026) and flowchart (June 2026), DPCAP workforce development page |
| Pearson details: WarU page, government ID, OnVUE often blocked on government computers, 90-day window | https://www.pearsonvue.com/us/en/waru.html |
| Competencies and job tasks used for the lesson structure and experience checklist | DoD Contracting Competency Model (Nov 2024) |
| Transition to one Contracting Professional level, 12 months experience, 3-year grace period, predecessor courses | Transition Plan, DoD Contracting Professional Certification Program (Jan 2022) |
| 40 of 80 CL hours on contracting recommended; credentials | DPCAP memo, Workforce Development and Continuous Learning Recommendations for 2025 (3 Feb 2025) |
| FAC-C (Professional) and DoW certification reciprocity; civilian 100 CL hours | Reciprocity MOU FAQs (Aug 2025) |
| 24 business credit hours removed; bachelor's degree for DoW 1102 under 10 U.S.C. 1724 | DPC memo, 3 Sep 2020 |
| AITAS: Army training application in ATRRS; help through CAMP; address https://www.atrrs.army.mil/Aitas/Public/Landing/ | USAASC FAQ pages (via search; asc.army.mil blocks Korean IP addresses); address confirmed by the developer, SFC Rabin Napit, 29 Oct 2026 |
| 51C: 9-week Army Acquisition Transition Course at TAAS, redesigned pilot July 2026 | Army.mil, "ALT-IO and DACM Office Shape a Stronger Acquisition Workforce" (25 Aug 2026) |
| MICC Launch program for new 51Cs (July 2026) | Army.mil, "MICC Launch Program builds elite talent, strengthens contracting force" (2026), https://www.army.mil/article/294806/ |
| DAU renamed Warfighting Acquisition University; catalog at icatalog.waru.edu | WarU iCatalog; press coverage of the November 2025 acquisition transformation |

## FAR, thresholds and the FAR Overhaul

| Fact | Source |
|---|---|
| RFO part titles, section numbers, old-to-new crosswalk, thresholds (MPT $15K, SAT $350K, contingency figures, SaP $9M, TINA $2.5M FAR / $10M DoW after 30 Jun 2026, DoW J&A Table 206-1, CDA $100K, DoW order protest $35M, Prompt Payment 4.75%) | Board Ready `app/src/data/regulations.json`, verified on acquisition.gov, DoW class deviations, eCFR and the U.S. Code on 13-14 Sep 2026 |
| RFO Part 4 closeout times (Table 4-2), Part 5 notice thresholds ($20K, 10/15 days) and response times (Table 5-3), Part 12 simplified procedures and micro-purchases, Part 13 scope and single-source D&F | acquisition.gov FAR Overhaul part pages 4, 5, 12, 13 (read 22 Oct 2026) |
| RFO part titles 1-19 | acquisition.gov FAR Part Deviation Guide (read 22 Oct 2026) |
| Formal rulemaking: 4 proposed rules 23 Jun 2026 (21 parts), 4 more 18 Sep 2026 (about 16 parts, comments due 19 Oct 2026), 4 still to come, no final rules yet | Law-firm and trade summaries of the Federal Register notices (Oct 2026) |
| DoW RFO class deviations effective 1 Feb 2026 | DoW rollout memo (Dec 2025) and Army Warranting Program Policy v12 (via Board Ready) |
| ACWS replaced PD2/SPS-A; SPS-A retired Dec 2025 | Army.mil and trade press |
| FPDS.gov retired 24 Feb 2026; award data in SAM.gov | Maintainer's SAM/FPDS skill notes |

## B2B class materials and the exam path (version 0.10.0)

The maintainer supplied the Back to Basics (B2B) class materials on 28 October 2026. They are kept outside the repository
(`B2B Exam Prep_Resources`, not committed) because they include instructor slides and DAU/WarU material. Their content was
checked against the RFO text and rewritten in the guide's own words; recalled real exam questions were turned into topics, not copied.
The full results are in `content/CLASS-MATERIAL-CHECK.md`.

| Material | Used for | Checked against |
|---|---|---|
| Back To Basics Day One, Prep Day 3, Day 4, Day 5 (slides) | Exam path week notes, Class material check, flashcards | acquisition.gov FAR Overhaul part pages 1-8, 10, 12-16, 19, 31-33, 42-46, 49 and 52 (read 28 Oct 2026) |
| Back to Basics final (practice exam, no answer key) | 143 class questions (`quiz-6-class-a/b.json`), answered and checked | Same; DFARS 215.371-2 (acquisition.gov) |
| Jeoparty B2B review (no answers); Pop quiz FAR parts | B2B Jeopardy flashcard deck; FAR part decks and game | Same |
| Study Guide for Exam; CON 3990V notes (test-taker recollections) | Test-taker tips and 34 topic questions (`quiz-6-class-c.json`) | Same |
| Contracting Study Guide V9 (19 May 2025) | Not used: protected by an Army Microsoft Purview sensitivity label | — |
| How the RFO Will Affect CON Certification, Student FAQ Sheet v1.8 (WarU, 16 Apr 2026) | Exam updated for the RFO on 31 Mar 2026, ~30% of the bank changed, threshold updates did not change questions | Maintainer's copy (PDF) |

## Official documents (0.13.0, checked 28 October 2026)

Every document linked from the DPCAP Contract Policy workforce development page
(https://www.acq.osd.mil/asda/dpc/cp/policy/workforce-development.html) and the links inside those PDFs were read in full.
Local copies are in `B2B Exam Prep_Resources/Official DPCAP and WarU documents/`; the page images in `src/official/` come
from them (`python tools/render_official.py`). The list with links lives in `src/data/official.json`.

| Fact used in the guide | Source |
|---|---|
| CL: at least 80 hours every 2 years, goal 40 a year, starting when the member enters an AWF position; grace period 3 years for the foundational category; certification standards cannot be waived; position waivers let the incumbent stay in the position | DoDI 5000.66, Change 3 (25 Mar 2022), paragraphs 4.4, 5.1 and 5.2 |
| Fourth attempt one year after the first failed attempt; DACM may approve more; cancel in the agency TAS and in Pearson; remediation table; condition of employment; grace period does not reset on promotion within contracting, resets on leaving and returning | Contracting Certification Exam FAQs (1 Oct 2026), questions 8, 14, 15 and 16 |
| 15-step exam process, task owners, 48-hour rule, 90-day window, reminders 3 days and 1 day before, score report by four areas, no certificate, transcript within 3 business days (sample report) | CON 3990V User Experience Roadmap (11 May 2026) with Attachment 1, and Flowchart (June 2026) |
| Eligibility (GS 1102, 1103, 1105 or military equivalent, coded, TAS approval), ID name must match, accommodations flag in the TAS profile, "Military Community" test centers, contact scheduling@waru.edu before travel, reschedule as often as needed in 90 days, expired authorization means a 30-day wait, Pearson phone 877-269-8108 | Pearson VUE WarU page, https://www.pearsonvue.com/us/en/waru.html |
| CON 3990V 150 questions, 3-hour seat time, 70%, test center recommended, CON 3900V only after a failed first try; CON 3910 about 22 hours (22 CLPs); CON 3900V 4 days, 13 hours, needs CON 3910; CON 7300V 28 hours over 7 days with a graded capstone simulation; course CLPs (1100V 29, 1200V 45, 1300V 41, 1400V 34, 7300V 28, 3990V 3) | WarU iCatalog course pages 12540, 12833, 12539, 12565, 12495, 12501, 12526, 12527 |
| Credential codes (CCON 014B, 015B, 022A, 024A, 025A, 003A) | WarU iCatalog Credentials, Contracting tab |
| CL point chart: formal at least 20, informal up to 60, professional up to 60, experience up to 60; points per activity | WarU Continuous Learning Point Credit chart |
| OJT tool: sample tasks per competency, rated 1 to 3 by employee and supervisor, signature page, start at entry on duty, review twice a year | WarU On-the-Job Training Tool for Contract Specialists (updated 22 Apr 2026) |
| Career ladder, credentials encouraged, graduate education, leader programs, DACM offices | DoW Contracting Career Field Model (Mar 2026) and the DCPAS leader development page it links |
| Exam built on the competency model, not on CON 1100-1400 alone; CON 3910 takers passed at about 9 in 10 (FY24); practice exam is a diagnostic, real exam a little harder; easy points: 20 FAR part titles, UCF, SF 30, SF 1449, DD 1155; read FAR Parts 1 and 15; about 9 in 10 questions come from the FAR; test-day habits | WarU podcast "CON 3990V: June 2024 Update" and WarU webinar "CON 3900/3910V Preparatory Course and CON 3990 Certification Exam" (Dec 2024); transcripts from the maintainer |
| Warrant model: selection, appointment on SF 1402, termination by letter; baseline certification, bachelor's degree (1102s and military equivalents) and 2 years of experience | Contracting Officer Warranting Program Model (Aug 2022) |
| 2024 A&S Workforce Framework | Listed on the DPCAP page; the link returned 404 on 28 Oct 2026 |
