export const meta = {
  name: 'corb-rfo-rewrite-waves',
  description: 'Rewrite citations in every official CORB board answer to Revolutionary FAR Overhaul numbering using the verified crosswalk, preserving meaning; Opus rewriters in waves, Fable reviewers guard meaning and cite validity',
  phases: [{ title: 'Rewrite A' }, { title: 'Rewrite B' }, { title: 'Review A' }, { title: 'Review B' }],
}

const APP = 'C:\\Users\\rabin\\Documents\\Army\\CORB\\app'
const BRIEF = `First read ${APP}\\docs\\AGENT_BRIEF.md and sections 3 and 8 of ${APP}\\docs\\CONTRACT.md. Working directory ${APP}. The question bank is ${APP}\\src\\data\\questions.json. The verified citation crosswalk is in ${APP}\\src\\data\\regulations.json under "crosswalk" (entries {old,new,title,note,confidence,source_url}) and "unchanged"; current dollar values are under "thresholds". If WebFetch/WebSearch are not loaded, load them with ToolSearch "select:WebFetch,WebSearch"; fetch acquisition.gov only for cites the crosswalk does not cover. Today is 14 September 2026; RFO numbering is in effect. Write valid UTF-8 JSON to the exact output path and return the structured summary. Do not edit any other file.`
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
  prompt: `${BRIEF}\n\nTASK: Process every question in the bank whose answer_status is "official" and whose domain is one of ${JSON.stringify(g)}. Skip items whose answer contains no regulatory reference at all (no FAR/DFARS/AFARS/PGI/U.S.C./CFR cite and no named FAR part or subpart in words); still include them in the output with changed=false so coverage is auditable. For each remaining item: (1) rewrite ONLY the citations to RFO numbering using the crosswalk; when a cite is absent from the crosswalk, resolve it on https://www.acquisition.gov/far-overhaul (per-part deviation guides) and record the pair; (2) keep the substance and wording otherwise intact — this is a citation-currency pass, not a rewrite; do not add new claims; (3) if the answer states a dollar threshold that the thresholds table shows has changed, keep the original number in the text but append "(threshold updated — see Thresholds)" and add a note; (4) if the answer references a FAR section that the RFO removed or moved to non-regulatory guidance, say so in one short parenthetical inside the answer and set rfo_status "updated" with the note; (5) ensure the answer ends with a "Cite:" line listing the RFO cites (add one if missing, built only from cites already present in the text or its crosswalk); (6) set rfo_status: "updated" (changed cites), "unverifiable" (a cite you could not resolve — keep the old cite and say so), or "n/a" (no cites). Output JSON: [{"id":"Q0012","changed":true,"answer":"full new answer text or null when unchanged","crosswalk":[{"old":"FAR 6.302-1","new":"FAR 6.103-1"}],"citations_rfo":["FAR 6.103-1"],"rfo_status":"updated","notes":"..."}]. Output path: ${APP}\\${`content\\out\\rfo_rewrite_${k + 1}.json`}.`,
}))

function rewrite(t) { return agent(t.prompt, { label: `rewrite:${t.key}`, schema: SUMMARY, model: 'opus', effort: 'medium' }) }
function review(t, summary) {
  return agent(`${BRIEF}\n\nYou are the reviewer for ${APP}\\${t.out} (author summary: ${JSON.stringify(summary)}). For every item with changed=true, diff the new answer against the original in questions.json (same id): the ONLY permitted differences are citation numbers, the trailing "Cite:" line, and short parentheticals about removed/moved sections or updated thresholds. Revert any substantive change (restore the original text with only the cite edits re-applied, or set changed=false). Verify each crosswalk pair against regulations.json or acquisition.gov; where a pair is wrong, fix it or set rfo_status "unverifiable" and restore the old cite. Confirm every "citations_rfo" entry appears in the answer text. Apply fixes directly in the file and write a change log to ${APP}\\${t.out.replace('.json', '.review.json')}.`, { label: `review:${t.key}`, schema: REVIEW, effort: 'high' })
}

phase('Rewrite A'); log('Rewrite wave A: ' + tasks.slice(0, 3).map(t => t.key).join(', '))
const sA = await parallel(tasks.slice(0, 3).map(t => () => rewrite(t)))
phase('Rewrite B'); log('Rewrite wave B: ' + tasks.slice(3).map(t => t.key).join(', '))
const sB = await parallel(tasks.slice(3).map(t => () => rewrite(t)))
const summaries = sA.concat(sB)
phase('Review A'); log('Review wave A')
const rA = await parallel(tasks.slice(0, 3).map((t, i) => () => summaries[i] ? review(t, summaries[i]) : Promise.resolve(null)))
phase('Review B'); log('Review wave B')
const rB = await parallel(tasks.slice(3).map((t, i) => () => summaries[i + 3] ? review(t, summaries[i + 3]) : Promise.resolve(null)))
const reviews = rA.concat(rB)
return { batches: tasks.map((t, i) => ({ key: t.key, summary: summaries[i], review: reviews[i] })), failed: tasks.filter((t, i) => !summaries[i]).map(t => t.key) }
