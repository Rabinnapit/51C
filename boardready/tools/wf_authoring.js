export const meta = {
  name: 'corb-authoring',
  description: 'Author open-question answers, Korea scenarios, topic primers, multiple-choice items and game content for the CORB app; each batch is reviewed and corrected by an independent agent',
  phases: [
    { title: 'Author', detail: 'batched authoring against the frozen question bank' },
    { title: 'Review', detail: 'independent accuracy review, corrections applied in place' },
  ],
}

const APP = 'C:\\Users\\rabin\\Documents\\Army\\CORB\\app'
const BRIEF = `First read ${APP}\\docs\\AGENT_BRIEF.md and sections 3, 7 and 8 of ${APP}\\docs\\CONTRACT.md. Working directory is ${APP}. The frozen question bank is ${APP}\\src\\data\\questions.json (278 items, ids Q0001-Q0278); source documents are in ${APP}\\content\\sources\\. If WebFetch or WebSearch are not loaded, load them with ToolSearch "select:WebFetch,WebSearch". Today is 13 September 2026; cite Revolutionary FAR Overhaul (RFO) numbering and verify any cite you are not certain of on https://www.acquisition.gov/far-overhaul (record the pair in a crosswalk array when you convert an old number). Plain text only in answer fields: short paragraphs, "- " bullets, no markdown headers, no HTML. Board-ready voice: the way a contracting officer would say it aloud in 45-90 seconds, ending with a "Cite:" line. Write valid UTF-8 JSON to the exact output path named below and return the structured summary. Do not edit any other file.`

const SUMMARY = { type: 'object', properties: { path: { type: 'string' }, count: { type: 'number' }, issues: { type: 'array', items: { type: 'string' } }, notes: { type: 'string' } }, required: ['path', 'count', 'issues', 'notes'] }
const REVIEW = { type: 'object', properties: { checked: { type: 'number' }, corrected: { type: 'number' }, removed: { type: 'number' }, findings: { type: 'array', items: { type: 'string' } }, notes: { type: 'string' } }, required: ['checked', 'corrected', 'removed', 'findings', 'notes'] }

const OPEN_SHAPE = `[{"id":"Q0018","answer":"...","key_points":["3-6 short bullets a candidate can memorize"],"citations":["RFO FAR 9.404"],"crosswalk":[{"old":"FAR 9.404","new":"FAR 9.404"}],"rfo_status":"updated|unverifiable|n/a","flags":["ai-drafted"],"confidence":"high|medium|low","confidence_reason":"..."}]`
const tasks = []

for (let k = 0; k < 4; k++) tasks.push({
  key: `open-${k + 1}`, out: `content\\out\\open_drafts_${k + 1}.json`, kind: 'open',
  prompt: `${BRIEF}\n\nTASK: Draft model answers for the open questions in ${APP}\\content\\open_questions.json at zero-based positions where (index % 4) == ${k}. These questions currently have no formal answer. For each, write the answer a strong candidate would give, matched to the question's classes (deeper for Class III/IV), grounded in the RFO FAR/DFARS/AFARS, statutes, or the Army warranting policy as applicable. Where the question is organization-specific (USACE, USAMRAA, 409th ABG-75 Germany, 411th Korea) answer from what is publicly knowable and say plainly what must be confirmed locally; add the flag "verify-locally" (and "korea-verify-cp" for Korea items). For opinion/leadership questions, give a structured, mature answer with 2-3 concrete examples. Output JSON: ${OPEN_SHAPE}. Output path: ${APP}\\content\\out\\open_drafts_${k + 1}.json.`
})

const KOREA_TOPICS = [
  ['LCS solicitation restricted to Korean firms and how that changes market research, synopsis and evaluation', 'LCS package routing: KO recommendation for award through USFK J4, ROK MND approval and award, invoice and payment by MND', 'the offshore-versus-local materials memo requirement for LCS packages', 'a customer asks to add O&M-funded line items to an LCS solicitation', 'an LCS requirement above the SaP ceiling that needs a source selection plan and formal evaluation', 'ROK fiscal year and calendar-year timing versus the U.S. fiscal year for LCS obligations', 'the SOFA Article XV Invited Contractor designation: KO responsibility for contract/order designation via USFK/FKAQ and the four unique-requirement exceptions', 'an invited contractor employee status question raised by the requiring activity', 'a Korean-won-denominated service contract and currency/exchange considerations in pricing and payment', 'a Korean subcontractor performing on a U.S. dollar contract: SOFA status, taxes, and flow-down questions'],
  ['exercise or contingency support contracting in Korea (e.g., theater exercise) under elevated micro-purchase and SAT contingency thresholds and the documentation a KO must keep', 'a GPC cardholder in Korea attempts to split a requirement to stay under the micro-purchase threshold', 'an unauthorized commitment by a facility manager on a Korean installation and the ratification path', 'host-nation labor law and wage considerations for a Korean-national workforce service contract', 'a Korean vendor protests a 411th award: agency protest handling and GAO jurisdiction questions', 'a foreign local national (FLN) direct-hire contract specialist seeking a warrant and the OCONUS HCA validation letter', 'terminating an LCS-funded contract for cause when the award was made by ROK MND', 'a requiring activity wants a personal-services-like arrangement with a Korean translator', 'warrant reciprocity: a KO OPCON to a different SCO in Korea after the PAE restructure (ACC Contracting Note 26-03)', 'a customer wants to buy a Korean-made vehicle and asks about Berry Amendment, Buy American and SOFA-related exceptions'],
]
for (let k = 0; k < 2; k++) tasks.push({
  key: `korea-${k + 1}`, out: `content\\out\\korea_scenarios_${k + 1}.json`, kind: 'korea',
  prompt: `${BRIEF}\n\nTASK: Author 10 new scenario-based board questions for 411th CSB (Korea) candidates, one per topic: ${KOREA_TOPICS[k].map((t, i) => `(${i + 1}) ${t}`).join('; ')}. Ground every Korea-specific statement in the study decks and the 411th questions in the bank (Q0254-Q0258, Q0274-Q0278) and in public sources (USFK, SOFA text, DoD/Army regulations); where the real answer depends on a local SOP, USFKI 4901.01, the LCS SOP, or a current threshold, say so explicitly in the answer ("confirm current procedure with C&P") and keep the flag "korea-verify-cp". Never invent local approval dollar levels, form numbers you cannot verify, or names. Each scenario: 3-6 sentence realistic setup with a dollar value and a decision the KO must make, then 2-4 sub-questions, then a model answer with key points and cites. Output JSON: [{"id":"K${k + 1}01","question":"setup + sub-questions","answer":"...","key_points":[...],"citations":[...],"classes":["II","III"],"topic":"LCS Procurement","domain":"Korea, LCS & SOFA","tags":["Korea","LCS Funding","Problem solving situations"],"kind":"scenario","unit":"411th CSB","flags":["ai-drafted","korea-verify-cp"],"confidence":"high|medium|low","confidence_reason":"...","sources_used":["..."]}]. Output path: ${APP}\\content\\out\\korea_scenarios_${k + 1}.json.`
})

const PRIMERS = [
  ['ko-authority', 'Contracting officer authority and the warrant: express, implied and apparent authority; what a warrant is and is not; ratification (RFO FAR 1.4/1.6, Army Warranting Policy v12)', 'Authority, Ethics & Leadership'],
  ['fiscal-law-trio', 'Fiscal law for KOs: purpose, time and amount; the bona fide needs rule; the Antideficiency Act; commitments vs obligations; certification of funds', 'Fiscal Law & Funding'],
  ['severable-crossfy', 'Severable vs non-severable services, 12-month cross-fiscal-year authority, lead-time and stock-level exceptions, incremental funding', 'Fiscal Law & Funding'],
  ['uac-ratification', 'Unauthorized commitments and ratification: criteria, who may ratify, the file, and prevention', 'Authority, Ethics & Leadership'],
  ['market-research-planning', 'Market research and acquisition planning under the RFO (Parts 7 and 10): when, how, documentation scaled to size and complexity', 'Competition & Market Research'],
  ['competition-exceptions', 'Full and open competition, the seven exceptions, limited-competition justifications and approvals, brand name, under-SAT documentation (RFO Part 6 and 12.102)', 'Competition & Market Research'],
  ['simplified-commercial', 'Simplified acquisition procedures, the SAT, the commercial simplified-procedures ceiling (SaP), commercial determinations, purchase orders and quotes (RFO Parts 12 and 13)', 'Acquisition Planning & Contract Types'],
  ['contract-types', 'Selecting a contract type: fixed-price family, cost-reimbursement family, T&M/LH, IDIQ/requirements/definite-quantity, options, and the risk logic boards want to hear (RFO Parts 16 and 17)', 'Acquisition Planning & Contract Types'],
  ['source-selection', 'Source selection: LPTA vs trade-off, evaluation factors, competitive range, clarifications vs communications vs discussions, SSEB/SSAC/SSA roles, debriefings (RFO Part 15)', 'Source Selection & Evaluation'],
  ['price-cost-analysis', 'Fair and reasonable: price analysis techniques, cost analysis, cost realism, certified cost or pricing data and its exceptions, unbalanced pricing, IGE roles (RFO 15.4)', 'Pricing, Cost & Payment'],
  ['responsibility', 'Responsibility determinations: the standards, SAM exclusions, suspension vs debarment, continuing existing contracts with excluded parties, Army DORA bot (RFO Part 9)', 'Responsibility & Exclusions'],
  ['ordering-options', 'IDIQ ordering and fair opportunity, BPAs and calls, exercising options: the determinations and DFARS checks (SAM, SPRS/CMMC), guaranteed minimums (RFO 16.5, 13.3, 17.2)', 'Acquisition Planning & Contract Types'],
  ['services-pws', 'Services acquisition: PWS vs SOW, performance-based requirements, QASP, personal vs non-personal services, inherently governmental functions, services acquisition strategy thresholds (RFO Part 37)', 'Acquisition Planning & Contract Types'],
  ['small-business', 'Small business programs: set-aside rules, the rule of two, socioeconomic categories, subcontracting plans, OCONUS applicability (RFO Part 19)', 'Small Business & Socioeconomic'],
  ['labor-standards', 'Labor standards a KO must apply: Service Contract Act, Davis-Bacon wage determinations and timing, Defense Base Act insurance and waivers (RFO Part 22, 28.305)', 'Property, Security & Special Provisions'],
  ['publicizing', 'Publicizing and synopsis requirements, SAM.gov postings, exceptions, timing between synopsis, solicitation and award (RFO Part 5)', 'Competition & Market Research'],
  ['contract-admin-cor', 'Contract administration: COR designation and limits, post-award orientation, modifications (bilateral vs unilateral, within scope), the Changes clause and the duty to proceed, REAs (RFO Parts 42 and 43)', 'Contract Administration'],
  ['terminations', 'Terminations: convenience vs default, cure and show-cause notices, excusable delay, commercial termination for cause (12.304), contractor liabilities after T4D, settlement basics (RFO Part 49)', 'Terminations & Remedies'],
  ['protests', 'Protests: agency vs GAO vs Court of Federal Claims, timeliness rules, the CICA stay and override findings, agency report timeline, task-order protest limits (RFO 33.1, 4 CFR 21)', 'Protests, Claims & Disputes'],
  ['claims-disputes', 'Claims and disputes: what is a claim, certification threshold, KO final decision timelines, interest, appeals to ASBCA or COFC, distinguishing REAs from claims (RFO 33.2, Contract Disputes Act)', 'Protests, Claims & Disputes'],
  ['government-property', 'Government property: GFP decisions and clauses, contractor-acquired property, liability for loss, property administration (RFO Part 45, 52.245-1)', 'Property, Security & Special Provisions'],
  ['closeout-reporting', 'Closeout, CPARS, contract action reporting after FPDS moved to SAM.gov, file documentation and VCE PCF discipline (RFO Parts 4 and 42)', 'Contract Administration'],
  ['grants-agreements-ota', 'Grants, cooperative agreements and Other Transactions: DoDGARs, 2 CFR 200, 10 U.S.C. 4021/4022, prototype OTs and follow-on production, GO and AO warrants under Army policy', 'Grants & Agreements'],
  ['korea-lcs-sofa', 'Korea for contracting officers: SMA and Logistics Cost Sharing, who awards LCS, restrictions, the SOFA Article XV Invited Contractor program, exercise/contingency support; everything flagged korea-verify-cp', 'Korea, LCS & SOFA'],
  ['ethics-oci', 'Ethics and integrity: procurement integrity, OCI types and mitigation, gifts, post-government employment, fraud indicators and reporting, how to say no to leadership (RFO Part 3, 9.5)', 'Authority, Ethics & Leadership'],
  ['warrant-program', 'The Army warranting program itself: classes and thresholds, calculating instrument value, boards (CORB/GORB/AORB), waivers, legacy warrants, VCE-Warrants records, suspension/termination/reinstatement, reciprocity', 'Authority, Ethics & Leadership'],
  ['board-day', 'How a warrant board works and how to answer: the 411th composition and cadence, the answer framework, handling "I don\'t know", follow-up probes, class-specific expectations', 'Authority, Ethics & Leadership'],
]
const PRIMER_BATCHES = [PRIMERS.slice(0, 9), PRIMERS.slice(9, 18), PRIMERS.slice(18)]
PRIMER_BATCHES.forEach((batch, k) => tasks.push({
  key: `primers-${k + 1}`, out: `content\\out\\primers_${k + 1}.json`, kind: 'primer',
  prompt: `${BRIEF}\n\nTASK: Write ${batch.length} study primers, one per item: ${batch.map(p => `[id=${p[0]}, domain="${p[2]}"] ${p[1]}`).join(' || ')}. Each primer teaches the topic the way a mentor KO would explain it before a board: a 2-3 sentence summary, then 4-7 sections (heading + 80-200 word plain-text body, "- " bullets allowed) covering the rule, the numbers, the process, the traps, and how boards probe it; then key_cites with RFO numbering (verify on acquisition.gov; give the URL when you fetched it), and 4-6 board_angles (likely board questions with a one-line ideal answer). Relate each primer to at least 3 question ids from ${APP}\\src\\data\\questions.json in related_questions. Output JSON: [{"id":"fiscal-law-trio","title":"...","domain":"...","summary":"...","sections":[{"heading":"...","body":"..."}],"key_cites":[{"ref":"RFO FAR 6.103-1","url":"...","note":"..."}],"board_angles":[{"q":"...","a":"..."}],"related_questions":["Q0007"],"flags":["ai-drafted"],"confidence":"high|medium|low","confidence_reason":"..."}]. Output path: ${APP}\\content\\out\\primers_${k + 1}.json.`
}))

const MCQ_GROUPS = [
  ['Fiscal Law & Funding', 'Competition & Market Research', 'Acquisition Planning & Contract Types'],
  ['Source Selection & Evaluation', 'Pricing, Cost & Payment', 'Contract Administration'],
  ['Terminations & Remedies', 'Protests, Claims & Disputes', 'Responsibility & Exclusions', 'Property, Security & Special Provisions', 'Small Business & Socioeconomic'],
  ['Authority, Ethics & Leadership', 'Grants & Agreements', 'Korea, LCS & SOFA', 'Germany ABG-75'],
]
MCQ_GROUPS.forEach((g, k) => tasks.push({
  key: `mcq-${k + 1}`, out: `content\\out\\mcq_${k + 1}.json`, kind: 'mcq',
  prompt: `${BRIEF}\n\nTASK: Write multiple-choice quiz items from the questions in ${APP}\\src\\data\\questions.json whose domain is one of ${JSON.stringify(g)} and whose answer_status is "official" (use the official answer and deck_notes as the ground truth; do not contradict them; if an official answer's cite is pre-RFO, use RFO numbering in the explanation and note the pair). Skip pure opinion/leadership questions. Produce up to 45 items, at most one per source question, preferring questions with concrete, checkable facts. Each item: a stem that tests the fact (rewrite the board question if needed), exactly 4 options with exactly one correct, plausible distractors that reflect real misconceptions (not obviously silly), and a one-sentence "why" for every option. Output JSON: [{"qid":"Q0007","stem":"...","options":[{"text":"...","correct":true,"why":"..."},{"text":"...","correct":false,"why":"..."},...],"difficulty":1,"cite":"RFO FAR ...","domain":"..."}]. Output path: ${APP}\\content\\out\\mcq_${k + 1}.json.`
}))

const GAMES = [
  { key: 'games-ladder-fiscal', out: 'content\\out\\games_1.json', spec: `Two games. (1) "threshold_ladder": 40 items, each an instrument or action with realistic dollar facts (base, options, ceiling, modification value) that the player must classify into the correct Army warrant class per Policy v12 Table 1 and the cumulative-value rule in section 4.2 (base + all options + ceiling + absolute value of a modification); include tricky ones (a $200 deductive mod on a $4.9M contract; an option exercise that crosses SaP; an IDIQ ceiling; a delivery order under a $600M ceiling). Fields: {"id","label","facts":["..."],"value_number","correct_class":"I|II|III|IV","explanation"}. Read ${APP}\\content\\sources\\warrant_thresholds_table_mar2026.txt. (2) "fiscal_sort": 36 short statements the player sorts into "Purpose", "Time", "Amount", or "No violation", with an explanation and cite each; include bona fide need, severable/non-severable, ADA, augmentation, and lead-time exception cases. Output JSON: {"threshold_ladder":[...],"fiscal_sort":[{"id","statement","bucket","explanation","cite"}]}.` },
  { key: 'games-clock-clause', out: 'content\\out\\games_2.json', spec: `Two games. (1) "protest_clock": 24 timeline cards covering agency protests, GAO protests, COFC, debriefings, the CICA stay, agency report and GAO decision deadlines, claims (CDA) deadlines and KO final decision timelines, cure/show-cause periods, and option notice periods. Each card: {"id","event":"...","days":number or null,"day_type":"calendar|business|null","anchor":"from award|from debriefing|from filing|...","rule":"one sentence","cite":"RFO FAR 33.104-3 / 4 CFR 21.x"}; the game asks players to place cards in order or match the number of days, so the numbers must be verified on acquisition.gov or ecfr.gov. (2) "clause_match": 40 pairs of FAR/DFARS clause or provision numbers (52.2xx / 252.2xx) with their titles and a one-line "when it applies" — confirm the numbers still exist under the RFO on acquisition.gov (record status "verified" or "unverified" per pair). Output JSON: {"protest_clock":[...],"clause_match":[{"id","clause","title","applies","status"}]}.` },
  { key: 'games-jeopardy-branching', out: 'content\\out\\games_3.json', spec: `Two games. (1) "jeopardy": a study-group board of 6 categories (Fiscal Law, Competition, Source Selection, Contract Admin, Protests & Claims, Korea & Warrant Program) x 5 values (100-500, harder as value rises), each with a clue in Jeopardy style, the expected response, an accepted-answers list (short forms), and a cite; plus one "final" clue. (2) "branching": 4 "You're the KO" cases (an Osan unauthorized-commitment emergency; an $11M LCS grounds maintenance requirement; a post-award GAO protest on a $150K IT award; a year-end bona fide need push for a janitorial contract) — each a node graph of 6-9 nodes: {"id","text","choices":[{"label","next","score":-2..3,"feedback"}]}, terminal nodes have empty choices and a debrief, start node id, learning_points, citations, flags ["ai-drafted","korea-verify-cp" where Korea]. Ground the Korea cases in ${APP}\\src\\data\\questions.json Q0254-Q0258 and Q0274-Q0278. Output JSON: {"jeopardy":{"categories":[{"name","clues":[{"value","clue","response","accepted":[],"cite"}]}],"final":{...}},"branching":{"cases":[{"id","title","unit","classes","setup","start","nodes":{...},"learning_points":[],"citations":[],"flags":[]}]}}.` },
]
GAMES.forEach(gm => tasks.push({ key: gm.key, out: gm.out, kind: 'game', prompt: `${BRIEF}\n\nTASK: Author game content. ${gm.spec} Output path: ${APP}\\${gm.out}.` }))

phase('Author')
log(`Launching ${tasks.length} authoring agents, each followed by an independent reviewer (${tasks.length * 2} agents — above the 15-agent guideline by design for a full content build).`)

// Model tiering. Authors: Korea scenarios stay on the default (Fable) because they need the most judgment about what
// is verifiable; open-answer drafts that already completed keep the default so their cache replays; everything else
// authors on Opus. Reviewers: open-answer and Korea reviews (regulatory accuracy) on Fable; MCQ and game reviews on Opus.
const COMPLETED_OPEN = ['open-2', 'open-3', 'open-4']
function authorModel(t) {
  if (t.kind === 'korea') return {}
  if (COMPLETED_OPEN.indexOf(t.key) >= 0) return {}
  return { model: 'opus' }
}
function reviewModel(t) { return (t.kind === 'open' || t.kind === 'korea') ? {} : { model: 'opus' } }
const results = await pipeline(
  tasks,
  t => agent(t.prompt, Object.assign({ label: `author:${t.key}`, phase: 'Author', schema: SUMMARY }, authorModel(t))),
  (summary, t) => {
    if (!summary) return null
    if (t.kind === 'primer') return { key: t.key, out: t.out, summary, review: null }
    const focus = {
      open: 'Verify every regulatory statement and cite (fetch acquisition.gov for any cite you cannot vouch for), check the answer actually answers all parts of the question at the right class depth, remove hallucinated program names or thresholds, make sure flags include "ai-drafted" and, where required, "verify-locally" or "korea-verify-cp".',
      korea: 'Be ruthless about Korea specifics: anything not supported by the 411th bank items (Q0254-Q0258, Q0274-Q0278), the study decks in content/sources, or a public source you fetched must be softened to "confirm with C&P" or removed. Check SOFA/LCS mechanics against the decks. Ensure no invented approval levels, form numbers or names.',
      primer: 'Check every cite against acquisition.gov RFO pages; fix pre-RFO numbering; verify dollar figures; make sure the body is plain text with no markdown headers; confirm related_questions ids exist in the bank and are relevant.',
      mcq: 'For every item confirm exactly one option is correct, that the correct option agrees with the source question\'s official answer in the bank, that distractors are not also defensible, and that stems are unambiguous. Delete unfixable items rather than leaving doubtful ones.',
      game: 'Check every number, class assignment, deadline and clause number against the sources or acquisition.gov/ecfr.gov; recompute each threshold_ladder value and class by hand; confirm node graphs have a start node, every "next" resolves, and terminal nodes are reachable.',
    }[t.kind]
    return agent(`${BRIEF}\n\nYou are an independent reviewer. Another agent wrote ${APP}\\${t.out} (summary: ${JSON.stringify(summary)}). Open it and review every item. ${focus} Apply corrections directly in the file, keeping the same JSON shape. Write a short review log to ${APP}\\${t.out.replace('.json', '.review.json')} listing each change. Report honestly.`, Object.assign({ label: `review:${t.key}`, phase: 'Review', schema: REVIEW, effort: 'high' }, reviewModel(t))).then(r => ({ key: t.key, out: t.out, summary, review: r }))
  }
)

const done = results.filter(Boolean)
log(`Completed ${done.length}/${tasks.length} batches with review.`)
return { batches: done, failed: tasks.filter((t, i) => !results[i]).map(t => t.key) }
