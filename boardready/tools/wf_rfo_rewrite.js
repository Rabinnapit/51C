export const meta = {
  name: 'corb-rfo-rewrite',
  description: 'Rewrite the citations in every official board answer to Revolutionary FAR Overhaul numbering using the verified crosswalk, preserving meaning; independent reviewers check each batch',
  phases: [
    { title: 'Rewrite', detail: 'six batches by domain, crosswalk-driven, acquisition.gov for gaps' },
    { title: 'Review', detail: 'meaning preserved, cites valid, flags honest' },
  ],
}

const APP = 'C:\\Users\\rabin\\Documents\\Army\\CORB\\app'
const BRIEF = `First read ${APP}\\docs\\AGENT_BRIEF.md and sections 3 and 8 of ${APP}\\docs\\CONTRACT.md. Working directory ${APP}. The question bank is ${APP}\\src\\data\\questions.json. The verified citation crosswalk is in ${APP}\\src\\data\\regulations.json under "crosswalk" (entries {old,new,title,note,confidence,source_url}) and "unchanged". If WebFetch/WebSearch are not loaded, load them with ToolSearch "select:WebFetch,WebSearch". Today is 13 September 2026; RFO numbering is in effect. Write valid UTF-8 JSON to the exact output path and return the structured summary. Do not edit any other file.`
const SUMMARY = { type: 'object', properties: { path: { type: 'string' }, count: { type: 'number' }, changed: { type: 'number' }, issues: { type: 'array', items: { type: 'string' } }, notes: { type: 'string' } }, required: ['path', 'count', 'changed', 'issues', 'notes'] }
const REVIEW = { type: 'object', properties: { checked: { type: 'number' }, corrected: { type: 'number' }, reverted: { type: 'number' }, findings: { type: 'array', items: { type: 'string' } }, notes: { type: 'string' } }, required: ['checked', 'corrected', 'reverted', 'findings', 'notes'] }

const GROUPS = [
  ['Fiscal Law & Funding', 'Competition & Market Research'],
  ['Acquisition Planning & Contract Types', 'Small Business & Socioeconomic'],
  ['Source Selection & Evaluation', 'Pricing, Cost & Payment'],
  ['Contract Administration', 'Terminations & Remedies', 'Property, Security & Special Provisions'],
  ['Protests, Claims & Disputes', 'Responsibility & Exclusions', 'Korea, LCS & SOFA', 'Germany ABG-75', 'General Contracting'],
  ['Authority, Ethics & Leadership', 'Grants & Agreements'],
]

const tasks = GROUPS.map((g, k) => ({
  key: `rfo-${k + 1}`, out: `content\\out\\rfo_rewrite_${k + 1}.json`,
  prompt: `${BRIEF}\n\nTASK: Process every question in the bank whose answer_status is "official" and whose domain is one of ${JSON.stringify(g)}. Skip items whose answer contains no regulatory reference at all (no FAR/DFARS/AFARS/PGI/U.S.C./CFR cite and no named FAR part or subpart in words); still include them in the output with changed=false so coverage is auditable. For each remaining item: (1) rewrite ONLY the citations to RFO numbering using the crosswalk; when a cite is absent from the crosswalk, resolve it on https://www.acquisition.gov/far-overhaul (per-part deviation guides) and record the pair; (2) keep the substance and wording otherwise intact — this is a citation-currency pass, not a rewrite; do not add new claims; (3) if the answer states a dollar threshold that the thresholds table in regulations.json shows has changed, keep the original number in the text but append "(threshold updated — see Thresholds)" and add a note; (4) if the answer references a FAR section that the RFO removed or moved to non-regulatory guidance, say so in one short parenthetical inside the answer and set rfo_status "updated" with the note; (5) ensure the answer ends with a "Cite:" line listing the RFO cites (add one if missing, built only from cites already present in the text or its crosswalk); (6) set rfo_status: "updated" (changed cites), "unverifiable" (a cite you could not resolve — keep the old cite and say so), or "n/a" (no cites). Output JSON: [{"id":"Q0012","changed":true,"answer":"full new answer text or null when unchanged","crosswalk":[{"old":"FAR 6.302-1","new":"FAR 6.103-1"}],"citations_rfo":["FAR 6.103-1"],"rfo_status":"updated","notes":"..."}]. Output path: ${APP}\\${`content\\out\\rfo_rewrite_${k + 1}.json`}.`,
}))

phase('Rewrite')
log(`Rewriting citations in ${tasks.length} domain batches, each with an independent reviewer (${tasks.length * 2} agents).`)
const results = await pipeline(
  tasks,
  // Model tiering: the mechanical citation pass runs on Opus; the reviewers that guard meaning and cite validity stay on the default (Fable).
  t => agent(t.prompt, { label: `rewrite:${t.key}`, phase: 'Rewrite', schema: SUMMARY, effort: 'high', model: 'opus' }),
  (summary, t) => summary ? agent(`${BRIEF}\n\nYou are the reviewer for ${APP}\\${t.out} (author summary: ${JSON.stringify(summary)}). For every item with changed=true, diff the new answer against the original in questions.json (same id): the ONLY permitted differences are citation numbers, the trailing "Cite:" line, and short parentheticals about removed/moved sections or updated thresholds. Revert any substantive change (set answer back to the original text with only the cite edits re-applied, or set changed=false). Verify each crosswalk pair against regulations.json or acquisition.gov; where a pair is wrong, fix it or set rfo_status "unverifiable" and restore the old cite. Confirm every "citations_rfo" entry appears in the answer text. Apply fixes directly in the file and write a change log to ${APP}\\${t.out.replace('.json', '.review.json')}.`, { label: `review:${t.key}`, phase: 'Review', schema: REVIEW, effort: 'high' }).then(r => ({ key: t.key, out: t.out, summary, review: r })) : null
)
const done = results.filter(Boolean)
log(`RFO rewrite batches complete: ${done.length}/${tasks.length}`)
return { batches: done, failed: tasks.filter((t, i) => !results[i]).map(t => t.key) }
