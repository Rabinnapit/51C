// Paste-runnable browser QA: visits every registered view (and key sub-routes), captures runtime errors, and reports.
// Usage in the browser console or via the javascript tool:  await window.__corbQA()
window.__corbQA = async function (opts) {
  opts = opts || {};
  const errors = [];
  const onErr = (e) => errors.push({ route: location.hash, msg: (e.error && e.error.stack) || e.message || String(e.reason || e) });
  window.addEventListener('error', onErr); window.addEventListener('unhandledrejection', onErr);
  const origErr = console.error; const logged = [];
  console.error = function () { logged.push({ route: location.hash, msg: Array.from(arguments).map(a => (a && a.stack) || String(a)).join(' ').slice(0, 300) }); origErr.apply(console, arguments); };
  const routes = (opts.routes || []).concat(CORB.viewOrder.map(id => '#/' + id));
  const extra = ['#/library?domain=Fiscal%20Law%20%26%20Funding', '#/library?id=Q0007', '#/process?tab=steps', '#/regulations?tab=thresholds', '#/regulations?tab=crosswalk', '#/arcade', '#/arcade?game=threshold-run', '#/arcade?game=boss-board', '#/jeopardy', '#/games', '#/scenarios?tab=branching', '#/quiz?domain=Protests%2C%20Claims%20%26%20Disputes', '#/mentor?q=bona%20fide%20need', '#/glossary?q=SAT', '#/primers?id=fiscal-law-trio'];
  const results = [];
  for (const r of routes.concat(extra)) {
    const before = errors.length + logged.length;
    location.hash = r;
    await new Promise(res => setTimeout(res, opts.wait || 350));
    const root = document.querySelector('#app .view');
    const text = root ? root.innerText.trim() : '';
    results.push({ route: r, rendered: !!root && text.length > 20, chars: text.length, newErrors: (errors.length + logged.length) - before, title: document.title });
  }
  window.removeEventListener('error', onErr); window.removeEventListener('unhandledrejection', onErr); console.error = origErr;
  location.hash = '#/dashboard';
  return { summary: { routes: results.length, failedRender: results.filter(r => !r.rendered).map(r => r.route), errors: errors.length + logged.length }, results, errors, logged };
};
'QA helper installed';
