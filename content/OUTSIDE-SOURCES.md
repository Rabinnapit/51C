# Outside study material for CON 3990V: what was checked

Checked 29 October 2026 for B2B Guide 0.15.0. Rule: bring in only material that is valuable, accurate and current
(garbage in, garbage out). The CON 3990V exam bank moved to the Revolutionary FAR Overhaul (RFO) on 31 March 2026
(WarU student FAQ), so anything older is checked line by line before it is trusted. Nothing from a third party was
copied into the guide: their text is not ours to copy, and none of it passed the accuracy check. What the guide gained is
listed at the end.

## Official sources: used

| Source | What it is | Verdict |
|---|---|---|
| [CON 3990V exam FAQ](https://www.acq.osd.mil/asda/dpc/cp/policy/workforce-development.html) (as of 1 Oct 2026) | 150 questions, 70% to pass, closed book; answers come from the RFO-updated FAR and DFARS; question count per competency; the 20 FAR part titles to know | Already in the guide (`cert.json`, Official documents). Its blueprint drove the gap check below |
| [FAR Companion](https://www.acquisition.gov/sites/default/files/page_file_uploads/far-companion.pdf), Version 2.0, 30 Oct 2025 | The FAR Council's non-regulatory, plain-language guide to the RFO, part by part | Linked. One catch: its table of contents calls Part 4 "Administration and Information Matters"; the RFO text says "Administrative and Information Matters". Learn part titles from the FAR text, not the Companion |
| [Searchable RFO](https://www.acquisition.gov/sites/default/files/page_file_uploads/RFO.pdf) | Every overhauled FAR part in one PDF | Linked |
| [FAR Overhaul FAQs](https://www.acquisition.gov/far-overhaul/faqs) (updated 26 Oct 2026) | How the RFO works, deviations, timeline | Linked |
| [FAI FAR Overhaul hub](https://www.fai.gov/node/40180) | WarU CONNECT Live (Thursdays 11:30 ET), office hours, "Navigating the FAR Framework", practitioner album attestations for CL points | Linked. Some items register through FAI's own learning system |
| [Pearson VUE demo test](https://www.pearsonvue.com/us/en/redirects/demo-test.html) | Demo of the testing screen, linked from Pearson's WarU page | Linked |
| [CON 3910](https://icatalog.waru.edu/CourseDetail/12833) | WarU's online prep course with a 150-question practice exam | Already in the guide |
| WarU Contracting Conversations and webinars on Kaltura | 2022 web series (CON courses and exam, parts 1 to 3), CON 3910 overview (Jun 2022), prep-course update (Sep 2023), exam update (Jun 2024), prep courses and exam webinar (Dec 2024) | The guide keeps the two 2024 recordings. The 2022 and 2023 ones predate later changes and the RFO |
| [FAI CON 3990V page](https://fai.gov/node/15738) and [FAI certification FAQs](https://www.fai.gov/node/44) | The same exam for civilian FAC-C (Professional) | Not used for rules: FAI allows four attempts for FAC-C, while DoW allows three in 12 months, and B2B follows DoW |

## Third-party sources: not used

| Source | What we found | Verdict |
|---|---|---|
| OpenExamPrep (open-exam-prep.com): free CON 3990V guide, 178 practice questions, 50 flashcards, cheat sheet | Independent site written by one author (an engineer and CFP), no contracting reviewer named. Thresholds were current ($15,000, $350,000, $2.5 million, $900,000). But its FAR part title map still gives the old titles for Part 13 (Simplified Acquisition Procedures) and Part 19 (Small Business Programs), both on the exam's list, and it groups Parts 12 and 13 as "commercial and simplified". Page dates disagree (January 2026 and September 2026) | Not linked: it is wrong on facts the exam tests |
| Quizlet: 9 CON 3990 decks opened on 29 Oct 2026 (the user cleared Quizlet's human check and signed in) | Most were made in 2022 to 2024. "DAU Contracting Certification Exam" (595 terms) and "CON 3990 Contracting Certification Quiz 1 of 4" (42) give the pre-RFO answer that exchanges after receipt are "communications, discussions and clarifications" (RFO: clarifications and negotiations, 15.202 and 15.204-2) and the old Part 13 and Part 19 titles. "Back to Basic Certification Contracting Exam" (411) answers the definition of the price negotiation memorandum with "Negotiation" and uses the old "commercial items" form titles. "CON 3990V Pre practice Test 2" (44) looks like DAU course quiz content and rests on pre-RFO Parts 12 and 13. The "2025/2026 most tested questions with verified answers" deck had been deleted by Quizlet. A related set is titled "CON 3910 Practice Exam" (150 terms); candidates get that practice exam free and current in CON 3910 itself | Not used. The guide instead tells readers how to check a deck before trusting it |
| Stuvia and similar "actual exam questions" or "150 practice questions with verified answers" sellers | Marketing claims to be the real exam | Skipped. WarU does not release exam questions; such sets are made up or leaked |
| CliffsNotes "Pointers for CON 3990 prep (as of 1 Oct 2023)" | Paywalled, written before the RFO | Not used |
| Audible and Amazon CON 3990V study guides (one by Philip Martin McCaulay) | Commercial, edition and accuracy unknown | Not used |
| NCMA CFCM exam prep | A different, paid exam | Not used |
| Reddit, WIFCON, LinkedIn | Searches found no CON 3990V threads to review | Nothing to use |

## Gap check against the official blueprint

The free decks and sites cover the same topics as the guide. Comparing the guide's bank with the FAQ's question count
per competency showed six thin spots, now filled with original questions written from the DoW Contracting Competency
Model (2024 narrative, in `B2B Exam Prep_Resources/Official DPCAP and WarU documents/`) and RFO FAR 15.408-1:

| Competency | Exam questions | Bank before | Bank after |
|---|---|---|---|
| 1.1 Skills and Roles | 6 | 5 | 6 |
| 1.5 Situational Assessment | 3 | 1 | 3 |
| 1.6 Team Dynamics | 3 | 1 | 3 |
| 2.2.1 Plan Sales | 3 | 2 | 3 |
| 2.2.2 Prepare Offer | 3 | 2 | 3 |
| 3.1.2 Plan Negotiations | 10 | 7 | 10 |

## What changed in the guide (0.15.0)

- Certification, The exam: "Study material from other places" (`exam.outside` in `cert.json`): use first, check before
  you trust, skip.
- Links: FAR Companion, searchable RFO PDF, FAR Overhaul FAQs, FAI FAR Overhaul hub, Pearson VUE demo test.
- Practice: Q0107, Q0108, Q0109, Q0707, Q0708, Q1905, Q1906, Q2208, Q2209, Q2210 (384 questions in all).

Check again when the FAR Council finishes the RFO rulemaking or WarU changes the exam bank.
