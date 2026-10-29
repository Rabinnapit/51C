# Moving Board Ready to Palantir Army Vantage

Board Ready (formerly working title Signatory) was built so the move is a re-hosting of the UI and a swap of the data layer, not a rewrite of content.

## What carries over unchanged

* **Content** — every module in `src/data/*.json` is plain JSON with a documented shape (`docs/CONTRACT.md` §3):
  `questions`, `primers`, `mcq`, `glossary`, `process`, `regulations` (map + crosswalk + thresholds), `rubric_board`, `games`, `resources`, `units`, `meta`.
  Load each as a Foundry dataset or object type. Suggested object types: `BoardQuestion`, `Primer`, `QuizItem`, `GlossaryTerm`,
  `ProcessStep`, `Regulation`, `CrosswalkEntry`, `Threshold`, `Resource`.
* **Rules** — readiness math, spaced repetition, rubric scoring (`src/js/core/07-scoring.js`) are pure functions; port them as-is or as Functions on Objects.
* **Design system** — `src/css/01-tokens.css` through `04-shell.css`.

## What changes

| Layer | Offline file | Vantage |
|---|---|---|
| Data access | `window.CORB_DATA` inlined at build | `CORB.data` adapter reads from OSDK / Ontology; same query API (`questions(filter)`, `search`, `byId`, `citeUrl`) |
| Progress | `CORB.store` → localStorage / exported file | Per-user objects (`CandidateProgress`, `BoardSession`) with Actions for writes |
| Identity & roles | role picker + local passcode | Foundry user, group-based roles (candidate / board / facilitator) |
| Mentor | offline retrieval, optional user-supplied endpoint | Vantage-hosted model via AIP with the same grounding contract (`connector.grounding(query)` → top-k excerpts) |
| Live regulation data | curated map + deep links, last-verified dates | scheduled ingestion from acquisition.gov (FAR/DFARS/AFARS pages, class deviations) into `Regulation` and `Threshold` objects with `verified_on` refreshed automatically |
| Content editing | facilitator editor → saved copy of the app | Actions with approval workflow (draft → reviewed → approved) |

## Deployment options

* **Workshop**: rebuild each view as Workshop widgets bound to the object types; the fastest path for the library, dashboard, board console. Games and mock board need custom widgets.
* **Custom app (OSDK + React)**: port `src/js/views/*.js` one-to-one; each view is already a function of `(root, ctx)` over `CORB.data` and `CORB.state`, which maps cleanly to a React component over OSDK hooks.
* **Slate**: possible for the reference views; not recommended for the interactive practice tools.

## Adapter checklist

1. Implement `CORB.data.all()` against the Ontology and keep the unit filter semantics (`units` includes the active unit or `ACC-All`).
2. Implement `CORB.get/set` over a per-user progress object; keep the same paths (`progress.seen`, `progress.srs`, `progress.quiz`, `progress.boards`).
3. Replace `CORB.connector.ask` with the AIP endpoint; keep `mentor(question, history)` and `offlineAnswer` as the fallback.
4. Keep every content badge; approval state maps to `answer_status` and `flags`.
5. Keep `citeUrl` deep links; add an ingestion job that refreshes `regulations.verified_on` and flags drift.
