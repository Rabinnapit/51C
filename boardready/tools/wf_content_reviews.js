export const meta = {
  name: 'corb-content-reviews',
  description: 'Independent accuracy reviews of the authored CORB content (open-answer drafts, Korea scenarios, quiz items, games, glossary) in small waves with tiered models; corrections applied in place',
  phases: [{ title: 'Wave 1' }, { title: 'Wave 2' }, { title: 'Wave 3' }, { title: 'Wave 4' }],
}

const APP = 'C:\\Users\\rabin\\Documents\\Army\\CORB\\app'
const BRIEF = `First read ${APP}\\docs\\AGENT_BRIEF.md and sections 3 and 8 of ${APP}\\docs\\CONTRACT.md. Working directory ${APP}. The question bank is ${APP}\\src\\data\\questions.json; the verified RFO crosswalk and thresholds are in ${APP}\\src\\data\\regulations.json — use them before fetching. If WebFetch/WebSearch are not loaded, load them with ToolSearch "select:WebFetch,WebSearch"; fetch acquisition.gov only for cites the crosswalk does not cover. Today is 14 September 2026; RFO numbering is in effect. Apply corrections directly in the file you are reviewing, keeping its JSON shape valid, and write a short change log to the same path with ".review.json" replacing ".json". Report honestly; if a file is missing, say so and stop.`
const REVIEW = { type: 'object', properties: { checked: { type: 'number' }, corrected: { type: 'number' }, removed: { type: 'number' }, findings: { type: 'array', items: { type: 'string' } }, notes: { type: 'string' } }, required: ['checked', 'corrected', 'removed', 'findings', 'notes'] }

const FOCUS = {
  open: 'Verify every regulatory statement and cite (crosswalk first, acquisition.gov second), check the answer answers every part of the question at the right class depth, remove hallucinated program names or thresholds, and make sure flags include "ai-drafted" plus "verify-locally" or "korea-verify-cp" where the question is organization- or Korea-specific.',
  korea: 'Be ruthless about Korea specifics: anything not supported by the 411th bank items (Q0254-Q0258, Q0274-Q0278), the study decks in content/sources, or a public source you fetched must be softened to "confirm with C&P" or removed. Check SOFA/LCS mechanics against the decks. No invented approval levels, form numbers or names.',
  mcq: 'For every item confirm exactly one option is correct, that the correct option agrees with the source question\'s answer in the bank, that distractors are not also defensible, and that stems are unambiguous. Delete unfixable items rather than leaving doubtful ones.',
  game: 'Check every number, class assignment, deadline and clause number against regulations.json, the thresholds table, or acquisition.gov/ecfr.gov; recompute each threshold_ladder value and class by hand; confirm node graphs have a start node, every "next" resolves, and terminal nodes are reachable.',
  glossary: 'Check a sample of 60 definitions for accuracy and RFO-era numbering, confirm every acronym expansion, remove any person names or emails, and add any term that appears in 40 sampled questions from questions.json but is missing.',
}
const T = (key, file, kind, model, effort) => ({ key, file, kind, model, effort })
const WAVES = [
  [T('open-2', 'open_drafts_2.json', 'open', null, 'high'), T('open-3', 'open_drafts_3.json', 'open', null, 'high'), T('open-4', 'open_drafts_4.json', 'open', null, 'high')],
  [T('mcq-1', 'mcq_1.json', 'mcq', 'opus', 'medium'), T('mcq-2', 'mcq_2.json', 'mcq', 'opus', 'medium'), T('mcq-3', 'mcq_3.json', 'mcq', 'opus', 'medium'), T('mcq-4', 'mcq_4.json', 'mcq', 'opus', 'medium')],
  [T('games-1', 'games_1.json', 'game', 'opus', 'medium'), T('games-2', 'games_2.json', 'game', 'opus', 'medium'), T('games-3', 'games_3.json', 'game', 'opus', 'medium'), T('glossary', 'glossary.json', 'glossary', 'sonnet', 'low')],
  [T('open-1', 'open_drafts_1.json', 'open', null, 'high'), T('korea-1', 'korea_scenarios_1.json', 'korea', null, 'high'), T('korea-2', 'korea_scenarios_2.json', 'korea', null, 'high')],
]
const done = [], failed = []
for (let i = 0; i < WAVES.length; i++) {
  phase(`Wave ${i + 1}`)
  log(`Wave ${i + 1}: ${WAVES[i].map(t => t.key).join(', ')}`)
  const res = await parallel(WAVES[i].map(t => () => agent(`${BRIEF}\n\nYou are the independent reviewer for ${APP}\\content\\out\\${t.file}. Open it and review every item. ${FOCUS[t.kind]}`, Object.assign({ label: `review:${t.key}`, schema: REVIEW, effort: t.effort }, t.model ? { model: t.model } : {}))))
  res.forEach((r, j) => { if (r) done.push({ key: WAVES[i][j].key, review: r }); else failed.push(WAVES[i][j].key) })
  log(`Wave ${i + 1} done: ${done.length} reviewed, ${failed.length} failed`)
}
return { done, failed }
