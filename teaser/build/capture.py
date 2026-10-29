"""Deterministic capture of the B2B Exam Prep teaser shots from the web edition (docs/), served on localhost.
The page clock (Date, performance.now, requestAnimationFrame) is virtualised and stepped one frame at a time, so
every animation (the Arcade's canvases and the 3D range included) renders at exactly 30 fps.
Frames are 1920x1080 @2x JPEG. Output: frames/<segment>/fNNNNN.jpg + frames/manifest.json
Usage: python capture.py [frames_dir] [dpr] [segments] [only]
  python capture.py ../frames 2                      every segment
  python capture.py ../frames 2 arcade,buddy only    just those two (the manifest keeps the rest)
NB: never use Playwright actions that wait on requestAnimationFrame here (click, hover); drive the page with JS and the
keyboard, and poll with polling=100.
"""
import base64, json, os, shutil, subprocess, sys, time
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__)); REPO = os.path.dirname(os.path.dirname(HERE))
DOCS = os.path.join(REPO, "docs"); PORT = 8797; URL = f"http://127.0.0.1:{PORT}/"
ROOT = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else "../frames")
DPR = int(sys.argv[2]) if len(sys.argv) > 2 else 2
RESUME = sys.argv[3] if len(sys.argv) > 3 else None
ONLY = len(sys.argv) > 4 and sys.argv[4] == "only"
FPS = 30; DT = 1000.0 / FPS; Q = 92
ORDER = ["home", "setup", "path", "cert", "lessons", "quiz", "cards", "arcade", "buddy", "lookup", "phone", "c_open", "c_title", "c_end"]
TERMS = json.load(open(os.path.join(REPO, "src", "data", "meta.json"), encoding="utf-8"))["terms"]["version"]
FONTS = open(os.path.join(REPO, "src", "css", "00-fonts.css"), encoding="utf-8").read()

# terms accepted, tour seen, Buddy's nudge already spent; then the virtual clock
INIT = r"""
try { localStorage.setItem('b2b.installAsked', String(Date.now()));
  localStorage.setItem('b2b.state.v1', JSON.stringify({version:'b2b-state-1', settings:{termsAccepted:'%s', tourSeen:true, buddyUsed:true}, meta:{updatedAt:new Date().toISOString()}})); } catch(e) {}
(() => {
  const RD = Date; const base = RD.now(); let vt = 0; let q = [];
  function D(...a){ if(!(this instanceof D)) return RD(); return a.length ? new RD(...a) : new RD(base + vt); }
  D.prototype = RD.prototype; D.now = () => base + vt; D.parse = RD.parse; D.UTC = RD.UTC;
  window.Date = D;
  performance.now = () => vt;
  let seq = 0;
  window.requestAnimationFrame = cb => { const id = ++seq; q.push([id, cb]); return id; };
  window.cancelAnimationFrame = id => { q = q.filter(e => e[0] !== id); };
  window.__vt = { step(ms){ vt += ms; const cbs = q; q = []; for(const [, cb] of cbs){ try{ cb(vt); }catch(e){} } return q.length; }, now(){ return vt; } };
})();
""" % TERMS

SETUP = r"""
(() => {
  const st = document.createElement('style'); st.id = '__teaser';
  st.textContent = '.reveal{opacity:1!important;transform:none!important;transition:none!important}'
    + '.buddy-fab.nudge,.buddy-fab.nudge *{animation:none!important}'
    + '.toasts{display:none!important}'
    + 'html{scrollbar-width:none}::-webkit-scrollbar{display:none}';
  document.head.appendChild(st);
})();
/* a big on-screen cursor + click ripple, driven per frame from Python (no CSS animation, so it steps cleanly) */
window.__cur = (() => {
  const el = document.createElement('div'); el.id = '__cursor';
  el.innerHTML = '<svg width="64" height="64" viewBox="0 0 24 24"><path d="M5 2.5l14.5 9.6-6.4 1.1 3.8 6.9-2.9 1.4-3.8-6.9L5 19.4z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg>';
  Object.assign(el.style, {position:'fixed', left:'0px', top:'0px', zIndex:'2147483000', pointerEvents:'none', display:'none',
    filter:'drop-shadow(0 4px 6px rgba(0,0,0,.55))', transformOrigin:'13px 7px'});
  document.body.appendChild(el);
  const rp = document.createElement('div'); rp.id = '__ripple';
  Object.assign(rp.style, {position:'fixed', width:'56px', height:'56px', marginLeft:'-28px', marginTop:'-28px', borderRadius:'50%',
    border:'4px solid #e2b65c', zIndex:'2147482999', pointerEvents:'none', display:'none', boxSizing:'border-box'});
  document.body.appendChild(rp);
  let cx = 0, cy = 0;
  return {
    show(x, y){ el.style.display = 'block'; this.to(x, y); },
    hide(){ el.style.display = 'none'; rp.style.display = 'none'; },
    to(x, y){ cx = x; cy = y; el.style.left = (x - 13) + 'px'; el.style.top = (y - 7) + 'px'; },
    press(on){ el.style.transform = on ? 'scale(.82)' : 'scale(1)'; },
    ripple(p){ if (p >= 1) { rp.style.display = 'none'; return; } rp.style.display = 'block'; rp.style.left = cx + 'px'; rp.style.top = cy + 'px';
      rp.style.transform = 'scale(' + (0.3 + 1.4 * p) + ')'; rp.style.opacity = String(1 - p); }
  };
})();
window.__ensureSetup = () => { if (!CORB.plan.hasSetup()) { CORB.set('profile.track', CORB.TRACKS[0].id); CORB.set('profile.start', CORB.util.today()); CORB.set('profile.goalMonths', 6); CORB.set('settings.setupDone', true); } };
window.__resetSetup = () => { CORB.set('profile.track', ''); CORB.set('profile.start', ''); CORB.set('settings.setupDone', false); CORB.set('settings.welcomeSeen', false); };
"""
def ease(p): return 2 * p * p if p < 0.5 else -1 + (4 - 2 * p) * p

class Rec:
    def __init__(self, page):
        self.page, self.segs, self.cur, self.t0, self.n = page, [], None, time.time(), 0
        self.sub = 1          # clock sub-steps per frame (2 keeps a game's adaptive-quality check from seeing "slow" frames)
    def seg(self, name):
        d = os.path.join(ROOT, name)
        if os.path.exists(d): shutil.rmtree(d)
        os.makedirs(d); self.cur = {"name": name, "frames": []}; self.segs.append(self.cur)
        print(f"[{time.time()-self.t0:6.1f}s] seg {name}", flush=True)
    def shot(self, dur):
        p = os.path.join(ROOT, self.cur["name"], f"f{len(self.cur['frames']):05d}.jpg")
        self.page.screenshot(path=p, type="jpeg", quality=Q); self.cur["frames"].append([p, round(dur, 5)]); self.n += 1
    def step(self, n=1): self.page.evaluate(f"for(let i=0;i<{n * self.sub};i++) __vt.step({DT / self.sub})")
    def settle(self, n=45): self.step(n)
    def anim(self, seconds, fn=None):
        n = max(1, round(seconds * FPS))
        for i in range(n):
            if fn: self.page.evaluate(fn((i + 1) / n))
            self.step(1); self.shot(1 / FPS)
    def hold(self, seconds, settle=45):
        if settle: self.settle(settle)
        self.shot(seconds)
    def real(self, ms): self.page.wait_for_timeout(ms)
    def until(self, pred, timeout=15000): self.page.wait_for_function(pred, timeout=timeout, polling=100)
    def js(self, code): self.page.evaluate("(() => {" + code + "; return 0; })()")
    def ev(self, expr): return self.page.evaluate(expr)
    def scroll_to(self, a, b, seconds):
        self.anim(seconds, lambda p: f"window.scrollTo(0, {a} + ({b} - {a}) * {ease(p)})")
    def top(self, js_expr, fallback=600, margin=110):
        y = self.page.evaluate("(() => { const e = " + js_expr + "; if(!e) return null; return e.getBoundingClientRect().top + window.scrollY; })()")
        if y is None: print("  (scroll target not found, using fallback)", flush=True); return fallback
        return max(0, y - margin)
    def dur(self): return sum(d for _, d in self.cur["frames"])
    def fill(self, total, floor=0.3): self.hold(max(floor, total - self.dur()), settle=0)
    def still_push(self, seconds, z0=1.0, z1=1.06, ox=50, oy=40):
        """Push in on a bitmap of the current screen: smooth, and no per-frame text re-rasterisation."""
        b64 = base64.b64encode(self.page.screenshot(type="jpeg", quality=95)).decode()
        self.js("const im = document.createElement('img'); im.id = '__still'; im.src = 'data:image/jpeg;base64," + b64 + "';"
                " Object.assign(im.style, {position:'fixed', left:'0', top:'0', width:'100vw', height:'100vh', zIndex:'2147482000',"
                f" transformOrigin:'{ox}% {oy}%', willChange:'transform'}}); document.body.appendChild(im)")
        self.real(250)
        self.anim(seconds, lambda p: f"document.getElementById('__still').style.transform = 'scale({z0 + (z1 - z0) * ease(p):.5f})'")
        self.js("const im = document.getElementById('__still'); if (im) im.remove()")
    def save(self):
        segs = [{"name": s["name"], "dur": round(sum(d for _, d in s["frames"]), 4), "frames": s["frames"]} for s in self.segs]
        segs.sort(key=lambda s: ORDER.index(s["name"]))
        json.dump({"fps": FPS, "dpr": DPR, "segments": segs}, open(os.path.join(ROOT, "manifest.json"), "w"), indent=1)

def elem_center(page, js_expr, fallback):
    pt = page.evaluate("(() => { const e = " + js_expr + "; if(!e) return null; const b = e.getBoundingClientRect(); return [b.left + b.width/2, b.top + b.height/2]; })()")
    if not pt: print("  (element not found, using fallback)", flush=True)
    return pt or list(fallback)

def cur_move(r, x0, y0, x1, y1, seconds):
    r.js(f"__cur.show({x0:.1f},{y0:.1f})")
    r.anim(seconds, lambda p: f"__cur.to({x0 + (x1 - x0) * ease(p):.1f}, {y0 + (y1 - y0) * ease(p):.1f})")

def cur_click(r, action_js, ripple_frames=8):
    r.js("__cur.press(true)"); r.anim(2 / FPS)
    r.js("__cur.press(false); " + action_js)
    r.anim(ripple_frames / FPS, lambda p: f"__cur.ripple({p:.3f})")

def type_text(r, page, text, frames_per_char):
    for ch in text:
        page.keyboard.type(ch); r.anim(frames_per_char / FPS)

def go(r, view, params=None, wait=800, settle=20):
    r.js(f"__cur.hide(); if (CORB.buddy && CORB.buddy.isOpen()) CORB.buddy.close(); CORB.go('{view}', {json.dumps(params or {})}); window.scrollTo(0, 0)")
    r.real(wait); r.settle(settle)

# ---------------- segments (durations sit on the 2.4 s bar grid) ----------------
def seg_home(r, page):        # 9.6 s: the first-visit hero, then down to "Build my plan"
    r.seg("home"); r.js("__resetSetup()"); go(r, "home", wait=1000, settle=30)
    r.still_push(4.8, 1.0, 1.045, 50, 30)
    y = r.top("document.querySelector('.setup-card')", 700, 90)
    r.scroll_to(0, y, 3.6); r.fill(9.6)

def pre_setup(r, page):
    r.js("__resetSetup()"); go(r, "home", wait=1000, settle=30)
    y = r.top("document.querySelector('.setup-card')", 700, 90)
    r.js(f"window.scrollTo(0, {y})"); r.settle(10)

def seg_setup(r, page):       # 7.2 s: pick "51C Soldier", Build my plan -> the exam path appears -> My plan from the menu
    r.seg("setup")
    ch = elem_center(page, "document.querySelector('.setup-form .choice')", (740, 620))
    cur_move(r, 1180, 380, ch[0], ch[1], 0.8)
    cur_click(r, "document.querySelector('.setup-form .choice').click()", 6)
    r.hold(0.5, settle=0)
    bt = elem_center(page, "[...document.querySelectorAll('.setup-card button')].find(b => /Build my plan/.test(b.textContent))", (660, 1000))
    cur_move(r, ch[0], ch[1], bt[0], bt[1], 0.7)
    cur_click(r, "[...document.querySelectorAll('.setup-card button')].find(b => /Build my plan/.test(b.textContent)).click()", 8)
    r.real(600); r.settle(12); r.hold(1.0, settle=0)                       # Exam path: week one, dated
    nv = elem_center(page, "document.querySelector('.side .nav[data-view=\"plan\"]')", (80, 233))
    cur_move(r, bt[0], bt[1], nv[0], nv[1], 0.7)
    cur_click(r, "document.querySelector('.side .nav[data-view=\"plan\"]').click()", 6)
    r.real(600); r.settle(12); r.js("__cur.hide()"); r.hold(0.6, settle=0)
    r.scroll_to(0, 380, max(0.8, 7.2 - r.dur() - 0.4)); r.fill(7.2)

def seg_path(r, page):        # 9.6 s: this week, then all 26 weeks scrolling past
    r.seg("path"); r.js("__ensureSetup()"); go(r, "path")
    r.hold(2.0, settle=0)
    tb = elem_center(page, "[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'All 26 weeks')", (700, 300))
    cur_move(r, 1250, 760, tb[0], tb[1], 0.7)
    cur_click(r, "[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'All 26 weeks').click()", 6)
    r.real(600); r.settle(12); r.js("__cur.hide()"); r.hold(0.8, settle=0)
    r.scroll_to(0, 1500, 4.6); r.fill(9.6)

def seg_cert(r, page):        # 7.2 s: the exam at a glance and the exam journey picture; the official library; one real document
    r.seg("cert"); r.js("__ensureSetup()"); go(r, "cert", {"tab": "exam"})
    r.hold(1.3, settle=0)
    y = r.top("document.querySelector('.xtiles, .stop-ref, .pic, .xchips')", 700, 130)
    r.scroll_to(0, y, 1.4); r.hold(0.8, settle=0)
    go(r, "official", wait=700, settle=15); r.hold(1.1, settle=0)
    doc = r.ev("(() => { const ids = ['exam-roadmap', 'exam-flowchart', 'exam-faq']; return ids.find(id => CORB.official.pageCount(id) > 0) || 'exam-roadmap'; })()")
    print("  official doc:", doc, flush=True)
    go(r, "official", {"doc": doc}, wait=700, settle=15); r.hold(0.9, settle=0)
    tb = elem_center(page, "[...document.querySelectorAll('button[role=tab]')].find(b => /official/i.test(b.textContent))", (900, 300))
    cur_move(r, 1200, 700, tb[0], tb[1], 0.5)
    cur_click(r, "[...document.querySelectorAll('button[role=tab]')].find(b => /official/i.test(b.textContent)).click()", 6)
    r.real(700); r.settle(12); r.js("__cur.hide()"); r.fill(7.2)

def seg_lessons(r, page):     # 9.6 s: the list, lesson one's picture playing part by part, then a Try-it tool sweeping the dollars
    r.seg("lessons"); r.js("__ensureSetup()"); go(r, "learn"); r.hold(1.2, settle=0)
    go(r, "lesson", {"id": "L01"}, wait=900)
    r.scroll_to(0, r.top("document.querySelector('.lesson-figs')", 500, 110), 0.8)
    FIG = "const fig = document.querySelector('.lesson-figs figure.lf'); const parts = [fig.querySelector('.lf-title')].concat([...fig.querySelectorAll('.lf-item')]).filter(Boolean);"
    r.js(FIG + " fig.classList.add('lf-in'); const b = fig.querySelector('.lf-play'); if (b) { b.setAttribute('aria-pressed', 'true'); b.replaceChildren(CORB.ui.icon('stop'), 'Stop'); }")
    n = r.ev("(() => { " + FIG + " return parts.length; })()")
    per = 3.4 / max(1, n)
    for i in range(n):
        r.js(FIG + f" parts.forEach(p => p.classList.remove('lf-on')); parts[{i}].classList.add('lf-on')"); r.hold(per, settle=2)
    r.js(FIG + " parts.forEach(p => p.classList.remove('lf-on')); const b = fig.querySelector('.lf-play'); if (b) { b.setAttribute('aria-pressed', 'false'); b.replaceChildren(CORB.ui.icon('play'), 'Play'); }")
    go(r, "lesson", {"id": "L13"}, wait=900)
    r.scroll_to(0, r.top("document.querySelector('.lf-type-calc')", 600, 100), 0.7)
    r.anim(2.6, lambda p: f"(() => {{ const rg = document.querySelector('.lf-type-calc .lf-range'); if (!rg) return; rg.value = String(Math.round(1000 * {p:.4f})); rg.dispatchEvent(new Event('input', {{bubbles: true}})); }})()")
    r.fill(9.6)

def seg_quiz(r, page):        # 7.2 s: Quick 10 -> a question -> the right answer, explained with its citation
    r.seg("quiz"); r.js("__ensureSetup()"); go(r, "quiz"); r.hold(0.9, settle=0)
    ST = "[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Start')"
    st = elem_center(page, ST, (1300, 300))
    cur_move(r, 1300, 820, st[0], st[1], 0.7)
    cur_click(r, ST + ".click()", 6)
    r.real(700); r.settle(12); r.js("__cur.hide()"); r.hold(1.3, settle=0)
    k = r.ev("(() => { const btns = [...document.querySelectorAll('.q-card .opt')]; const texts = btns.map(b => b.innerText.replace(/^[A-D]\\s*/, '').trim());"
             " const q = CORB.data.questions().find(q => q.options && q.options.length === texts.length && q.options.every(o => texts.includes(String(o.text || '').trim())));"
             " if (!q) return 0; const c = q.options.find(o => o.correct) || q.options[0]; return Math.max(0, texts.indexOf(String(c.text || '').trim())); })()")
    print("  quiz: correct option index", k, flush=True)
    op = elem_center(page, f"document.querySelectorAll('.q-card .opt')[{k}]", (960, 700))
    cur_move(r, st[0], st[1], op[0], op[1], 0.7)
    cur_click(r, f"document.querySelectorAll('.q-card .opt')[{k}].click()", 6)
    r.real(500); r.settle(10); r.js("__cur.hide()")
    sh = r.ev("Math.max(0, document.documentElement.scrollHeight - window.innerHeight)")
    if sh > 60: r.scroll_to(0, min(sh, 260), 0.8)
    r.fill(7.2)

def seg_cards(r, page):       # 4.8 s: a deck, the question side, the flip
    r.seg("cards"); r.js("__ensureSetup()"); go(r, "cards"); r.hold(0.7, settle=0)
    DK = "(() => { const c = [...document.querySelectorAll('.decks .card')].find(c => /Acronyms/.test(c.textContent)) || document.querySelector('.decks .card'); return c && [...c.querySelectorAll('button, a')].find(b => /Study/.test(b.textContent)); })()"
    dk = elem_center(page, DK, (1300, 480))
    cur_move(r, 1400, 160, dk[0], dk[1], 0.6)
    cur_click(r, DK + ".click()", 6)
    r.real(600); r.settle(10); r.js("__cur.hide()"); r.hold(1.0, settle=0)
    fc = elem_center(page, "document.querySelector('button.fc')", (1090, 480))
    cur_move(r, dk[0], dk[1], fc[0], fc[1], 0.5)
    cur_click(r, "document.querySelector('button.fc').click()", 6)
    r.real(400); r.settle(8); r.js("__cur.hide()"); r.fill(4.8)

def range_fire(r, page):
    """One exposure: the keyboard walks the sight to the board that carries the answer, then fires."""
    k = r.ev("(() => { const run = ARCADE._debug.run(); if (!run || !run.inst || !run.inst.stats) return 0; const s = run.inst.stats();"
             " const t = (s.targets || []).map((b, i) => ({i, ok: b.ok, x: b.x == null ? i : b.x})).sort((a, b) => a.x - b.x); const j = t.findIndex(b => b.ok); return j < 0 ? 0 : j; })()")
    print("  range: answer is board", k, flush=True)
    for _ in range(k + 1):
        page.keyboard.press("ArrowRight"); r.anim(5 / FPS)
    r.anim(0.4)
    page.keyboard.press("Space"); r.anim(1.3)

def seg_arcade(r, page):      # 9.6 s: the lobby's cabinets, then Range Day: the tower's clue, three boards, two shots
    r.seg("arcade"); r.js("__ensureSetup()"); r.sub = 2; go(r, "arcade", wait=1500, settle=30)
    CAB = "[...document.querySelectorAll('.ar-cab')].find(c => /Range Day/.test(c.textContent))"
    cab = elem_center(page, CAB, (420, 650))
    r.anim(0.7)
    cur_move(r, 1400, 900, cab[0], cab[1] + 30, 0.9); r.anim(0.4)
    cur_click(r, CAB + ".click()", 6)
    r.real(1800); r.js("__cur.hide()"); r.settle(4); r.js("ARCADE._debug.start()"); r.settle(4); r.real(300)
    r.anim(0.8)                                                            # the clue and the reading gate
    r.js("const g = document.querySelector('.ar-gate-go'); if (g) g.click()"); r.anim(0.9)   # boards rise
    range_fire(r, page)
    r.anim(0.9)                                                            # boards drop, the next exposure rises
    r.js("const g = document.querySelector('.ar-gate-go'); if (g) g.click()"); r.anim(0.7)
    range_fire(r, page)
    print("  range stats:", r.ev("(() => { const run = ARCADE._debug.run(); const s = run && run.inst && run.inst.stats ? run.inst.stats() : {}; return {hits: s.hits, n: s.n, ammo: s.ammo, scale: s.scale, gl: s.gl}; })()"), flush=True)
    left = 9.6 - r.dur()
    if left > 0.05: r.anim(left)
    r.sub = 1

def seg_buddy(r, page):       # 7.2 s: the bubble, the question typed, the answer from the guide
    r.seg("buddy"); r.js("__ensureSetup(); ARCADE && ARCADE.unmount && ARCADE.unmount()"); go(r, "learn")
    fab = elem_center(page, "document.querySelector('.buddy-fab')", (1830, 1035))
    cur_move(r, 1000, 520, fab[0], fab[1], 0.8)
    cur_click(r, "document.querySelector('.buddy-fab').click()", 6)
    r.real(400); r.settle(6)
    r.js("const p = document.querySelector('.buddy'); if (p) { p.style.zoom = '1.3'; p.style.right = '20px'; p.style.bottom = '20px'; }")
    r.js("__cur.hide()"); r.hold(0.8, settle=4)
    r.js("document.querySelector('.buddy input.input').focus()")
    type_text(r, page, "When can I take the exam?", 2)
    r.hold(0.3, settle=0); page.keyboard.press("Enter"); r.real(500); r.settle(6); r.anim(0.3)
    r.fill(7.2)

def seg_lookup(r, page):      # 4.8 s: the glossary answering a search, then the dollar thresholds
    r.seg("lookup"); r.js("__ensureSetup()"); go(r, "glossary"); r.hold(0.5, settle=0)
    r.js("document.getElementById('gl-q').focus()")
    type_text(r, page, "COR", 3); r.real(400); r.settle(10); r.hold(1.0, settle=0)
    go(r, "far", {"tab": "numbers"})
    y = r.top("[...document.querySelectorAll('h2')].find(h => /Dollar thresholds/.test(h.textContent))", 300, 100)
    r.scroll_to(0, y, 1.0); r.fill(4.8)

# ---------------- composites on an auxiliary page: the phone shot and the three title cards ----------------
AUX = None
def aux_page(r, ctx):
    global AUX
    if AUX is None:
        AUX = ctx.new_page(); AUX.set_content("<!doctype html><html><head><meta charset='utf-8'><style>" + FONTS + "html,body{margin:0;width:1920px;height:1080px;overflow:hidden;background:#070d0a}</style></head><body></body></html>")
        AUX.wait_for_timeout(300)
    return AUX

def phone_shots(br):
    """Phone-sized screens of the web edition (Android Chrome user agent) for the composite."""
    out = os.path.join(ROOT, "phone_src"); os.makedirs(out, exist_ok=True)
    ctx = br.new_context(viewport={"width": 412, "height": 915}, device_scale_factor=2, is_mobile=True, has_touch=True,
                         user_agent="Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36")
    ctx.add_init_script(INIT); pg = ctx.new_page()
    pg.goto(URL + "#/home", wait_until="load", timeout=60000); pg.wait_for_timeout(1500)
    pg.evaluate("(() => {" + SETUP + "})()"); pg.evaluate("__ensureSetup(); CORB.go('home')"); pg.wait_for_timeout(600); pg.evaluate("for(let i=0;i<60;i++) __vt.step(33.3)")
    pg.screenshot(path=os.path.join(out, "home.png"))
    pg.evaluate("CORB.go('lesson', {id: 'L01'}); window.scrollTo(0, 0)"); pg.wait_for_timeout(900); pg.evaluate("for(let i=0;i<60;i++) __vt.step(33.3)")
    pg.evaluate("const f = document.querySelector('.lesson-figs'); if (f) { window.scrollTo(0, f.getBoundingClientRect().top + window.scrollY - 70); f.querySelector('figure.lf').classList.add('lf-in'); }")
    pg.wait_for_timeout(600); pg.screenshot(path=os.path.join(out, "lesson.png"))
    pg.evaluate("CORB.go('arcade'); window.scrollTo(0, 0)"); pg.wait_for_timeout(1500); pg.evaluate("for(let i=0;i<80;i++) __vt.step(33.3)")
    pg.evaluate("const g = document.querySelector('.ar-cabinets'); if (g) window.scrollTo(0, g.getBoundingClientRect().top + window.scrollY - 60)")
    pg.wait_for_timeout(400); pg.evaluate("for(let i=0;i<20;i++) __vt.step(33.3)")
    pg.screenshot(path=os.path.join(out, "arcade.png"))
    ctx.close(); print("  phone shots ok", flush=True)

PHONE_HTML = """
<style>
.card{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 40%,#1b4a39 0%,#10281f 46%,#070d0a 100%)}
.card:after{content:"";position:absolute;inset:0;box-shadow:inset 0 0 320px 90px rgba(0,0,0,.72);pointer-events:none}
.grid{position:absolute;inset:0;opacity:.07;background-image:linear-gradient(#e2b65c 1px,transparent 1px),linear-gradient(90deg,#e2b65c 1px,transparent 1px);background-size:96px 96px}
.left{position:absolute;left:170px;top:250px;width:900px;font-family:"Archivo","Segoe UI",sans-serif;font-weight:800;color:#f5f8f4}
.line{font-size:92px;line-height:1.1;margin-bottom:28px;opacity:0;transform:translateY(24px)}
.line.brass{color:#e2b65c;margin-top:30px;font-size:70px}
.eyebrow{font-family:"JetBrains Mono","Consolas",monospace;letter-spacing:.42em;font-size:24px;color:#e2b65c;text-transform:uppercase;margin-bottom:40px;font-weight:400}
.phone{position:absolute;left:1220px;top:90px;width:430px;height:900px;border-radius:60px;background:#0b100d;box-shadow:0 50px 120px -30px rgba(0,0,0,.9),0 0 0 2px #2a3a31,0 0 0 10px #141c17;padding:16px}
.screen{position:relative;width:100%;height:100%;border-radius:46px;overflow:hidden;background:#f3f5f1}
.screen img{position:absolute;left:0;top:0;width:100%;height:auto;opacity:0}
.notch{position:absolute;left:50%;top:26px;width:22px;height:22px;margin-left:-11px;border-radius:50%;background:#000;z-index:3;box-shadow:0 0 0 3px rgba(0,0,0,.35)}
</style>
<div class="card"><div class="grid"></div>
<div class="left"><div class="eyebrow">One guide, every screen</div>
<div class="line" id="l0">On your phone.</div><div class="line" id="l1">On your laptop.</div><div class="line" id="l2">On a NIPR desktop.</div>
<div class="line brass" id="l3">Free. No app store.</div></div>
<div class="phone" id="ph"><div class="notch"></div><div class="screen"><img id="s0" src="{S0}"><img id="s1" src="{S1}"><img id="s2" src="{S2}"></div></div>
</div>
<script>
window.__anim = p => {
  const fade = (el, t0, len) => { const q = Math.min(1, Math.max(0, (p - t0) / len)); el.style.opacity = q; el.style.transform = 'translateY(' + (24 * (1 - q)) + 'px)'; };
  fade(l0, 0.04, 0.09); fade(l1, 0.26, 0.09); fade(l2, 0.48, 0.09); fade(l3, 0.72, 0.09);
  const imgs = [s0, s1, s2]; const seg = 1 / 3;
  imgs.forEach((im, i) => { const a0 = i * seg, a1 = a0 + seg; let o = 0;
    if (i === 0) o = p < a1 - 0.06 ? 1 : Math.max(0, 1 - (p - (a1 - 0.06)) / 0.06);
    else { o = Math.min(1, Math.max(0, (p - (a0 - 0.06)) / 0.06)); if (i < 2 && p > a1 - 0.06) o = Math.max(0, 1 - (p - (a1 - 0.06)) / 0.06); }
    im.style.opacity = o; });
  ph.style.transform = 'translateY(' + (Math.sin(p * 6.283) * 8) + 'px) rotate(' + (-2 + 1.5 * p) + 'deg)';
};
</script>
"""
def img64(path): return "data:image/png;base64," + base64.b64encode(open(path, "rb").read()).decode()

def seg_phone(r, page, ctx):   # 7.2 s composite: four lines and a phone cycling through three screens
    r.seg("phone"); ax = aux_page(r, ctx); keep = r.page; r.page = ax
    ph = os.path.join(ROOT, "phone_src")
    ax.set_content("<!doctype html><html><head><meta charset='utf-8'><style>" + FONTS + "html,body{margin:0;width:1920px;height:1080px;overflow:hidden;background:#070d0a}</style></head><body>"
                   + PHONE_HTML.replace("{S0}", img64(os.path.join(ph, "home.png"))).replace("{S1}", img64(os.path.join(ph, "lesson.png"))).replace("{S2}", img64(os.path.join(ph, "arcade.png"))) + "</body></html>")
    ax.wait_for_timeout(500); ax.evaluate("document.fonts.ready.then(() => 1)"); ax.wait_for_timeout(200)
    r.anim(7.2, lambda p: f"__anim({p:.4f})")
    r.page = keep

def card_push(r, ctx, png_name, seconds, z0=1.0, z1=1.06):
    ax = aux_page(r, ctx); keep = r.page; r.page = ax
    b64 = base64.b64encode(open(os.path.join(os.path.dirname(HERE), "cards", png_name + ".png"), "rb").read()).decode()
    ax.set_content("<!doctype html><html><head><meta charset='utf-8'><style>html,body{margin:0;width:1920px;height:1080px;overflow:hidden;background:#070d0a}</style></head><body>"
                   "<img id='__card' src='data:image/png;base64," + b64 + "' style='position:fixed;left:0;top:0;width:100vw;height:100vh;transform-origin:50% 50%;will-change:transform'></body></html>")
    ax.wait_for_timeout(400)
    r.anim(seconds, lambda p: f"document.getElementById('__card').style.transform = 'scale({z0 + (z1 - z0) * p:.5f})'")
    r.page = keep

def seg_c_open(r, page, ctx):  r.seg("c_open");  card_push(r, ctx, "card_open", 4.8, 1.0, 1.03)
def seg_c_title(r, page, ctx): r.seg("c_title"); card_push(r, ctx, "card_title", 4.8, 1.0, 1.06)
def seg_c_end(r, page, ctx):   r.seg("c_end");   card_push(r, ctx, "card_end", 11.2, 1.0, 1.07)

SEGS = {n: globals()["seg_" + n] for n in ORDER}
AUX_SEGS = {"phone", "c_open", "c_title", "c_end"}
PRE = {"setup": pre_setup}

def main():
    todo = RESUME.split(",") if ONLY else ORDER[ORDER.index(RESUME):] if RESUME else ORDER
    if not RESUME:
        if os.path.exists(ROOT): shutil.rmtree(ROOT)
        os.makedirs(ROOT)
    os.makedirs(ROOT, exist_ok=True)
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--directory", DOCS, "--bind", "127.0.0.1"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1.0)
    try:
        with sync_playwright() as p:
            br = p.chromium.launch(channel="msedge", headless=True, args=["--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
            if "phone" in todo: phone_shots(br)
            ctx = br.new_context(viewport={"width": 1920, "height": 1080}, device_scale_factor=DPR)
            ctx.add_init_script(INIT)
            page = ctx.new_page(); errs = []; page.on("pageerror", lambda e: errs.append(str(e)[:200]))
            page.set_default_timeout(30000)
            page.goto(URL + "#/home", wait_until="load", timeout=120000); page.wait_for_timeout(2000)
            r = Rec(page); r.js(SETUP); r.settle(60)
            if RESUME:
                mp = os.path.join(ROOT, "manifest.json")
                if os.path.exists(mp): r.segs = [s for s in json.load(open(mp))["segments"] if s["name"] not in todo]
            t = time.time(); page.screenshot(type="jpeg", quality=Q); print(f"screenshot cost {time.time()-t:.2f}s at DPR {DPR}; capturing {todo}", flush=True)
            for name in todo:
                if name in PRE: PRE[name](r, page)
                if name in AUX_SEGS: SEGS[name](r, page, ctx)
                else: SEGS[name](r, page)
                r.save()
            print("frames:", r.n, "| segments:", ", ".join(f"{s['name']}={sum(d for _, d in s['frames']):.1f}s" for s in r.segs))
            print("pageerrors:", errs[:5]); br.close()
    finally:
        srv.terminate()

if __name__ == "__main__":
    main()
