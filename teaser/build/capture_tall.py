"""The phone-sized (portrait) cut of the teaser: the same fifteen shots on the same timeline as capture.py, filmed from
the web edition at a phone's size, so the words on screen can be read on a phone. The narration, the music and every
shot boundary are the landscape cut's (assemble.py's TL), so the sound mix is reused as it is.

The picture is 1080 x 1920. The app is filmed in a 360 x 560 viewport at 3x (1080 x 1680) and sits under a 240 px
caption band (assemble_tall.py), so no caption ever covers the app. Taps show as a touch dot, not a mouse cursor.
The title cards and the "every screen" composite are filmed full frame on a 1080 x 1920 page.
Frames: frames_tall/<segment>/fNNNNN.jpg + frames_tall/manifest.json
Usage: python capture_tall.py [frames_dir] [dpr] [segments] [only]
  python capture_tall.py ../frames_tall 3                    every segment
  python capture_tall.py ../frames_tall 3 quiz,cards only    just those (the manifest keeps the rest)
  python capture_tall.py ../frames_tall_smoke 2              a quick look first (then build/sheet.py)
"""
import base64, json, os, shutil, subprocess, sys, time
if len(sys.argv) < 2: sys.argv.append("../frames_tall")
if len(sys.argv) < 3: sys.argv.append("3")
import capture as C                                   # reads the same arguments; ROOT, DPR and the helpers come from it
from capture import Rec, elem_center, type_text, ease, go, FPS, FONTS
from playwright.sync_api import sync_playwright

ROOT, DPR, RESUME, ONLY, ORDER = C.ROOT, C.DPR, C.RESUME, C.ONLY, C.ORDER
W, H = 360, 560                                       # the phone screen in CSS pixels (x3 = 1080 x 1680)
CW, CH = 1080, 1920                                   # the full frame, for cards and the composite
UA = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36"
CARDS = os.path.join(os.path.dirname(C.HERE), "cards_tall")
QUIZ_SEED, CARD_SEED, RANGE_SEED = 26, 3, 11           # which question, card and range terms come up (see pick_seeds)

# a seedable Math.random, so the quiz question, the flashcard and the range's terms are the same on every capture
INIT = C.INIT + r"""
(() => { let s = 20261120;
  Math.random = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  window.__seed = n => { s = n | 0; };
})();
"""

# the touch dot replaces capture.py's arrow: it fades in where the finger lands, presses, ripples and goes
TOUCH = r"""
(() => {
  const old = document.getElementById('__cursor'); if (old) old.remove();
  const el = document.createElement('div'); el.id = '__cursor';
  Object.assign(el.style, {position:'fixed', left:'0px', top:'0px', width:'46px', height:'46px', marginLeft:'-23px', marginTop:'-23px', borderRadius:'50%',
    background:'rgba(255,255,255,.5)', border:'2px solid rgba(16,28,22,.6)', boxShadow:'0 0 0 2px rgba(255,255,255,.8), 0 4px 12px rgba(0,0,0,.4)',
    zIndex:'2147483000', pointerEvents:'none', display:'none', boxSizing:'border-box'});
  document.body.appendChild(el);
  const rp = document.getElementById('__ripple'); let cx = 0, cy = 0;
  window.__cur = {
    show(x, y){ el.style.display = 'block'; el.style.opacity = '1'; el.style.transform = 'scale(1)'; this.to(x, y); },
    hide(){ el.style.display = 'none'; if (rp) rp.style.display = 'none'; },
    to(x, y){ cx = x; cy = y; el.style.left = x + 'px'; el.style.top = y + 'px'; },
    fade(p){ el.style.opacity = String(p); el.style.transform = 'scale(' + (1.4 - 0.4 * p) + ')'; },
    press(on){ el.style.transform = on ? 'scale(.76)' : 'scale(1)'; },
    ripple(p){ if (!rp) return; if (p >= 1) { rp.style.display = 'none'; return; } rp.style.display = 'block'; rp.style.left = cx + 'px'; rp.style.top = cy + 'px';
      rp.style.transform = 'scale(' + (0.4 + 1.5 * p) + ')'; rp.style.opacity = String(1 - p); el.style.opacity = String(Math.max(0, 1 - p * 1.6)); }
  };
  // Range Day: where the board with the answer is on the screen, and a touch on the game's canvas
  window.__board = () => { const run = ARCADE._debug.run(); if (!run || !run.inst || !run.inst.stats) return null; const s = run.inst.stats();
    const t = (s.targets || []).find(b => b.ok && b.fall < 0) || (s.targets || []).find(b => b.ok); if (!t) return null;   // fall is -1 while a board stands
    const cv = [...document.querySelectorAll('canvas')].filter(c => c.getBoundingClientRect().width > 200).pop(); if (!cv) return null;
    const r = cv.getBoundingClientRect(); return [r.left + t.x * r.width / s.W, r.top + t.y * r.height / s.H, t.text]; };
  window.__touch = (x, y) => { const e = document.elementFromPoint(x, y); if (!e) return 'nothing';
    ['pointerdown', 'pointerup'].forEach(tp => e.dispatchEvent(new PointerEvent(tp, {bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1, pointerType: 'touch', isPrimary: true})));
    return e.tagName; };
})();
"""

def sy(r): return r.ev("window.scrollY")
def maxy(r): return r.ev("Math.max(0, document.documentElement.scrollHeight - window.innerHeight)")

def glide(r, y, seconds):
    """Scroll from where the page is to y; a target already in place holds for the same time, so the shot keeps its length."""
    a = sy(r); y = max(0, min(y, maxy(r)))
    if abs(y - a) < 6:
        if seconds > 0.04: r.hold(seconds, settle=0)
        return
    r.scroll_to(a, y, seconds)

def y_of(r, expr, pos=0.5):
    """The scroll position that puts the element's centre at `pos` of the screen height."""
    v = r.ev("(() => { const e = " + expr + "; if (!e) return null; const b = e.getBoundingClientRect(); return b.top + b.height / 2 + window.scrollY; })()")
    if v is None: print("  (scroll target not found: " + expr[:70] + ")", flush=True); return sy(r)
    return v - pos * H

def tap(r, page, expr, action=None, lead=0.3, ripple=7, at=None):
    """A finger tap: the dot fades in on the element, presses, the action runs, the ring spreads."""
    pt = at or elem_center(page, expr, (W / 2, H / 2))
    r.js(f"__cur.show({pt[0]:.1f},{pt[1]:.1f}); __cur.fade(0)")
    r.anim(lead, lambda p: f"__cur.fade({ease(p):.3f})")
    r.js("__cur.press(true)"); r.anim(2 / FPS)
    r.js("__cur.press(false); " + ((expr + ".click()") if action is None else action))
    r.anim(ripple / FPS, lambda p: f"__cur.ripple({p:.3f})")
    r.js("__cur.hide()")
    return pt

# ---------------- segments: the lengths are assemble.py's (the 2.4 s bar grid) ----------------
def seg_home(r, page):        # 9.6 s: the first-visit Home, the three things the certification takes, then the setup card
    r.seg("home"); r.js("__resetSetup()"); go(r, "home", wait=1000, settle=30)
    r.still_push(1.5, 1.045, 1.0, 50, 30)
    glide(r, y_of(r, "document.querySelector('.home-three')", 0.5), 1.3); r.hold(3.0, settle=0)   # "Five courses. One exam. Twelve months."
    glide(r, r.top("document.querySelector('.setup-card')", 900, 76), 1.6); r.fill(9.6)

def pre_setup(r, page):
    r.js("__resetSetup()"); go(r, "home", wait=1000, settle=30)
    y = r.top("document.querySelector('.setup-card')", 900, 76)
    r.js(f"window.scrollTo(0, {y})"); r.settle(10)

def seg_setup(r, page):       # 7.2 s: the four steps: 51C Soldier, Next past the dates, the look and the voice, Build my plan -> My plan
    r.seg("setup")
    CHO = "document.querySelector('.setup-card .choice')"
    NEXT = "[...document.querySelectorAll('.setup-card button')].find(b => /^\\s*(Next|Build my plan)/.test(b.textContent))"
    r.hold(0.25, settle=0)
    tap(r, page, CHO, lead=0.3); r.hold(0.15, settle=0)
    for i in range(4):                                                       # Next, Next, Next, Build my plan
        glide(r, y_of(r, NEXT, 0.7), 0.4)
        tap(r, page, NEXT, lead=0.22)
        r.real(300); r.settle(8)
        if i < 3: r.hold(0.3, settle=0)                                     # each step's title on screen for a moment
    r.real(600); r.settle(12); r.fill(7.2)                                   # My plan: week one, dated

def seg_path(r, page):        # 9.6 s: My plan, this week; then all 26 weeks scrolling past with their dates and checkpoints
    r.seg("path"); r.js("__ensureSetup()"); go(r, "plan")
    r.hold(1.2, settle=0)
    ALL = "[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'All weeks')"
    tap(r, page, ALL, lead=0.3)
    r.real(600); r.settle(12); r.hold(0.4, settle=0)
    m1 = r.top("[...document.querySelectorAll('h2, h3, .month-head, .path-month')].find(e => /Foundation/.test(e.textContent))", 600, 150)
    glide(r, m1, 1.3)                                                         # past "How the path works" to month 1
    glide(r, min(maxy(r), m1 + 2100), 5.6); r.fill(9.6)

def seg_cert(r, page):        # 7.2 s: the exam at a glance; the official library; one real document's official pages
    r.seg("cert"); r.js("__ensureSetup()"); go(r, "cert", {"tab": "exam"})
    r.hold(0.5, settle=0)
    y = r.top("[...document.querySelectorAll('h2')].find(h => /at a glance/.test(h.textContent))", 280, 76)
    glide(r, y, 0.6); glide(r, y + 440, 1.5); r.hold(0.2, settle=0)   # 150 questions, 3 hours, 70 %, the pass rate
    go(r, "official", wait=700, settle=15); r.hold(0.3, settle=0)
    glide(r, r.top("[...document.querySelectorAll('h2')].find(h => /The exam/.test(h.textContent))", 380, 76), 0.6); r.hold(0.4, settle=0)
    doc = r.ev("(() => { const ids = ['exam-roadmap', 'exam-flowchart', 'exam-faq']; return ids.find(id => CORB.official.pageCount(id) > 0) || 'exam-roadmap'; })()")
    print("  official doc:", doc, flush=True)
    go(r, "official", {"doc": doc}, wait=700, settle=15); r.hold(0.4, settle=0)
    TAB = "[...document.querySelectorAll('button[role=tab]')].find(b => /official/i.test(b.textContent))"
    glide(r, y_of(r, TAB, 0.28), 0.4)
    tap(r, page, TAB, lead=0.22)
    r.real(900); r.settle(12)
    glide(r, r.top(TAB, 400, 84), 0.7)                                       # the press redraws the page from its top: back down to the pages
    glide(r, sy(r) + 110, 0.9); r.fill(7.2)

def seg_lessons(r, page):     # 9.6 s: the list, lesson one's picture read part by part, then a Try-it tool sweeping the dollars
    r.seg("lessons"); r.js("__ensureSetup()"); go(r, "learn"); r.hold(0.5, settle=0)
    glide(r, r.top("[...document.querySelectorAll('a[href*=\"lesson?id=L01\"]')].pop()", 520, 150), 0.9); r.hold(0.4, settle=0)
    go(r, "lesson", {"id": "L01"}, wait=900); r.hold(0.3, settle=0)
    glide(r, r.top("document.querySelector('.lesson-figs')", 500, 70), 0.7)
    FIG = "const fig = document.querySelector('.lesson-figs figure.lf'); const parts = [fig.querySelector('.lf-title')].concat([...fig.querySelectorAll('.lf-item')]).filter(Boolean);"
    r.js(FIG + " fig.classList.add('lf-in'); fig.classList.add('lf-playing'); const b = fig.querySelector('.lf-play'); if (b) { b.setAttribute('aria-pressed', 'true'); b.replaceChildren(CORB.ui.icon('stop'), 'Stop'); }")
    r.real(700)                                                             # the picture's build-up runs on the real clock
    y0 = sy(r); y1 = y0 + max(0, r.ev("document.querySelector('.lesson-figs figure.lf').getBoundingClientRect().height") - 400)
    def play(p):                                                            # the part being read lights up; the page follows it down
        q = ease(max(0.0, min(1.0, (p - 0.3) / 0.6)))
        return "(() => { " + FIG + f" const k = Math.min(parts.length - 1, Math.floor({p:.4f} * parts.length * 0.999)); parts.forEach((x, i) => x.classList.toggle('lf-on', i === k)); window.scrollTo(0, {y0} + ({y1} - {y0}) * {q:.4f}); }})()"
    r.anim(3.2, play)
    r.js(FIG + " parts.forEach(p => p.classList.remove('lf-on')); fig.classList.remove('lf-playing')")
    go(r, "lesson", {"id": "L13"}, wait=900)
    yc = r.top("document.querySelector('.lf-type-calc')", 600, 76)
    r.js(f"window.scrollTo(0, {yc})"); r.settle(6)
    r.hold(0.4, settle=0)
    r.anim(2.5, lambda p: f"(() => {{ const rg = document.querySelector('.lf-type-calc .lf-range'); if (!rg) return; rg.value = String(Math.round(1000 * {p:.4f})); rg.dispatchEvent(new Event('input', {{bubbles: true}})); }})()")
    r.fill(9.6)

def seg_voice(r, page):       # 7.2 s: Listen to the lesson; then Settings: the voice list with the app's own voices, Hear a sample
    r.seg("voice"); r.js("__ensureSetup()"); go(r, "lesson", {"id": "L05"}, wait=900)
    LB = "[...document.querySelectorAll('button')].find(b => /Listen to the lesson/.test(b.textContent))"
    r.hold(0.4, settle=0); tap(r, page, LB, lead=0.3)
    r.real(300); r.settle(6); r.hold(0.8, settle=0)                         # the button reads Stop while it speaks
    r.js("if (CORB.speech) CORB.speech.stop()")
    go(r, "settings", {"tab": "display"}, wait=800)
    # the voice picker opened as a list, so the app's own voices show; Joe selected
    r.js("const s = document.getElementById('tts-voice'); if (s) { s.size = 6; const o = [...s.options].find(o => /\\bJoe\\b/.test(o.textContent)); if (o) o.selected = true; }")
    r.settle(5)
    y = r.top("document.querySelector('label[for=tts-voice]')", 900, 150)
    r.js(f"window.scrollTo(0, {y})"); r.settle(5); r.hold(1.2, settle=0)
    HS = "[...document.querySelectorAll('button')].find(b => /Hear a sample/.test(b.textContent))"
    glide(r, y_of(r, HS, 0.6), 0.7); r.hold(0.5, settle=0)
    tap(r, page, HS, lead=0.3)                                               # the Joe sample plays here in the mix (4.7 s into the shot)
    r.real(300); r.settle(4); r.fill(7.2)

def seg_quiz(r, page):        # 7.2 s: Practice -> Quick 10 -> a question -> the right answer, explained with its citation
    r.seg("quiz"); r.js("__ensureSetup()"); go(r, "practice"); r.hold(0.6, settle=0)
    QK = "document.querySelector('.p-tile[data-tile=quick]')"
    r.js(f"__seed({QUIZ_SEED})")
    tap(r, page, QK, lead=0.3)
    r.real(700); r.settle(12); r.hold(1.2, settle=0)
    k = r.ev("(() => { const btns = [...document.querySelectorAll('.q-card .opt')]; const texts = btns.map(b => b.innerText.replace(/^[A-D]\\s*/, '').trim());"
             " const q = CORB.data.questions().find(q => q.options && q.options.length === texts.length && q.options.every(o => texts.includes(String(o.text || '').trim())));"
             " if (!q) return 0; const c = q.options.find(o => o.correct) || q.options[0]; return Math.max(0, texts.indexOf(String(c.text || '').trim())); })()")
    print("  quiz: correct option index", k, "|", r.ev("(document.querySelector('.q-stem-big') || {}).textContent"), flush=True)
    OP = f"document.querySelectorAll('.q-card .opt')[{k}]"
    glide(r, y_of(r, "document.querySelector('.q-card .opts')", 0.52), 0.6); r.hold(0.3, settle=0)
    tap(r, page, OP, lead=0.3)
    r.real(500); r.settle(10)
    glide(r, r.top("document.querySelector('.q-card .opts')", sy(r) + 120, 84), 0.8)   # the answer, green, and its explanation under it
    r.fill(7.2)

def seg_cards(r, page):       # 4.8 s: a deck, the question side, the flip
    r.seg("cards"); r.js("__ensureSetup()"); go(r, "cards"); r.hold(0.5, settle=0)
    DK = "(() => { const c = [...document.querySelectorAll('.decks .card')].find(c => /Acronyms/.test(c.textContent)) || document.querySelector('.decks .card'); return c && [...c.querySelectorAll('button, a')].find(b => /Study/.test(b.textContent)); })()"
    glide(r, y_of(r, DK, 0.6), 0.5)
    r.js(f"__seed({CARD_SEED})")
    tap(r, page, DK, lead=0.25)
    r.real(600); r.settle(10); r.hold(0.8, settle=0)
    print("  card:", r.ev("(document.querySelector('button.fc') || {}).innerText"), flush=True)
    tap(r, page, "document.querySelector('button.fc')", lead=0.25)
    r.real(400); r.settle(8); r.fill(4.8)

def rec_until(r, pred, max_s, min_s=0.0):
    """Film frame by frame until the page says so (or max_s has passed)."""
    n = 0; lim = round(max_s * FPS)
    while n < lim:
        r.anim(1 / FPS); n += 1
        if n >= round(min_s * FPS) and r.ev(pred): break
    return n / FPS

GATE = "(() => { const g = document.querySelector('.ar-gate-go'); return !!(g && g.offsetParent !== null); })()"   # the reading time is open

def range_tap(r, page, lead=0.25):
    """One exposure: a touch on the board that carries the answer (a tap aims and fires)."""
    b = r.ev("__board()")
    if not b: print("  range: no board found", flush=True); r.anim(lead + 0.3); return
    print("  range: answer board at", round(b[0]), round(b[1]), b[2], flush=True)
    tap(r, page, "null", action="(() => { const b = __board(); if (b) __touch(b[0], b[1]); })()", lead=lead, at=[b[0], b[1]])

def seg_arcade(r, page):      # 9.6 s: the lobby, the Range Day cabinet, then the range: the tower's clue, three boards, two shots
    r.seg("arcade"); r.js("__ensureSetup()"); r.sub = 2; go(r, "arcade", wait=1500, settle=30)
    CAB = "[...document.querySelectorAll('.ar-cab')].find(c => /Range Day/.test(c.textContent))"
    r.anim(0.6)                                                             # the lobby opens on today's range card
    glide(r, r.top("document.querySelector('.ar-cabinets')", 900, 70), 1.2); r.anim(0.3)
    r.js(f"__seed({RANGE_SEED})")
    tap(r, page, CAB, action="", lead=0.25)                                 # press and ripple, still in the lobby
    r.js(CAB + ".click()")                                                  # the game starts off camera
    r.real(1800); r.settle(4); r.js("ARCADE._debug.start()"); r.settle(24); r.real(300)
    GO = "document.querySelector('.ar-gate-go')"
    w = rec_until(r, GATE, 2.0); r.anim(0.5)                                # the tower's clue; the game opens its reading time
    tap(r, page, GO, lead=0.22); r.anim(0.75)                               # Skip: the boards finish rising
    range_tap(r, page); r.anim(1.1)                                         # hit: the board drops
    w2 = rec_until(r, GATE, min(1.6, max(0.1, 9.6 - r.dur() - 1.9)))        # the next exposure's clue
    print(f"  range: reading time after {w:.2f}s, the next after {w2:.2f}s; {9.6 - r.dur():.2f}s left", flush=True)
    if 9.6 - r.dur() >= 1.7 and r.ev(GATE):                                 # room for a second shot
        r.anim(0.2); tap(r, page, GO, lead=0.2); r.anim(0.6); range_tap(r, page, lead=0.2)
    print("  range stats:", r.ev("(() => { const run = ARCADE._debug.run(); const s = run && run.inst && run.inst.stats ? run.inst.stats() : {}; return {hits: s.hits, n: s.n, ammo: s.ammo, scale: s.scale, gl: s.gl}; })()"), flush=True)
    left = 9.6 - r.dur()
    if left > 0.05: r.anim(left)
    r.sub = 1

def seg_buddy(r, page):       # 7.2 s: the Buddy button, the question typed, the answer from the guide
    r.seg("buddy"); r.js("__ensureSetup(); ARCADE && ARCADE.unmount && ARCADE.unmount()"); go(r, "learn")
    r.hold(0.3, settle=0)
    tap(r, page, "document.querySelector('.buddy-fab')", lead=0.3)
    r.real(400); r.settle(6); r.hold(0.6, settle=4)
    r.js("document.querySelector('.buddy input.input').focus()")
    type_text(r, page, "When can I take the exam?", 2)
    r.hold(0.25, settle=0); page.keyboard.press("Enter"); r.real(600); r.settle(6)
    # the answer is longer than the screen: bring its first lines up under the question
    tgt = r.ev("(() => { const log = document.querySelector('.buddy-log'); const m = [...log.querySelectorAll('.bmsg')]; const q = m[m.length - 2] || m[m.length - 1];"
               " const y = Math.max(0, q.offsetTop - log.offsetTop - 10); log.scrollTop = y; return [y, Math.max(0, log.scrollHeight - log.clientHeight)]; })()")
    y1 = min(tgt[1], tgt[0] + 130)
    r.anim(0.3); r.hold(1.2, settle=0)
    r.anim(1.8, lambda p: f"document.querySelector('.buddy-log').scrollTop = {tgt[0]} + ({y1} - {tgt[0]}) * {ease(p):.4f}")
    r.fill(7.2)

def seg_lookup(r, page):      # 4.8 s: the glossary answering a search, then the dollar thresholds
    r.seg("lookup"); r.js("__ensureSetup()"); go(r, "glossary"); r.hold(0.35, settle=0)
    r.js("document.getElementById('gl-q').focus()")
    type_text(r, page, "COR", 3); r.real(400); r.settle(10)
    tools = r.ev("(() => { const t = document.querySelector('.gl-tools'); return t ? t.getBoundingClientRect().height : 200; })()")
    glide(r, r.top("document.querySelector('.gl-list .gl-item')", 500, 61 + tools + 14), 0.6); r.hold(1.0, settle=0)   # the term, under the search tools that stay on screen
    go(r, "far", {"tab": "numbers"})
    y = r.top("[...document.querySelectorAll('h2')].find(h => /Dollar thresholds/.test(h.textContent))", 300, 76)
    glide(r, y, 0.8); r.fill(4.8)

# ---------------- full-frame pages: the "every screen" composite and the three title cards ----------------
def device_shots(br):
    """The same guide on a phone, a laptop and a tablet, for the composite."""
    out = os.path.join(ROOT, "device_src"); os.makedirs(out, exist_ok=True)
    def shoot(name, vw, vh, dpr, mobile, view, params, prep=""):
        kw = dict(viewport={"width": vw, "height": vh}, device_scale_factor=dpr)
        if mobile: kw.update(is_mobile=True, has_touch=True, user_agent=UA)
        ctx = br.new_context(**kw); ctx.add_init_script(INIT); pg = ctx.new_page()
        pg.goto(C.URL + "#/home", wait_until="load", timeout=60000); pg.wait_for_timeout(1500)
        pg.evaluate("(() => {" + C.SETUP + "})()"); pg.evaluate("document.getElementById('__cursor').remove()")
        pg.evaluate(f"__ensureSetup(); CORB.go('{view}', {json.dumps(params)}); window.scrollTo(0, 0)"); pg.wait_for_timeout(900)
        pg.evaluate("for(let i=0;i<60;i++) __vt.step(33.3)")
        if prep: pg.evaluate(prep); pg.wait_for_timeout(700); pg.evaluate("for(let i=0;i<20;i++) __vt.step(33.3)")
        pg.screenshot(path=os.path.join(out, name + ".png")); ctx.close()
    fig = "(() => { const f = document.querySelector('.lesson-figs'); if (f) { window.scrollTo(0, f.getBoundingClientRect().top + window.scrollY - 90); f.querySelector('figure.lf').classList.add('lf-in'); } })()"
    shoot("phone", 390, 844, 2, True, "plan", {})
    shoot("laptop", 1440, 900, 1, False, "home", {})
    shoot("tablet", 820, 1180, 1, False, "lesson", {"id": "L01"}, fig)
    print("  device shots ok", flush=True)

EVERY_HTML = """
<style>
*{box-sizing:border-box}
.card{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 38%,#1b4a39 0%,#10281f 46%,#070d0a 100%)}
.card:after{content:"";position:absolute;inset:0;box-shadow:inset 0 0 300px 80px rgba(0,0,0,.72);pointer-events:none}
.grid{position:absolute;inset:0;opacity:.07;background-image:linear-gradient(#e2b65c 1px,transparent 1px),linear-gradient(90deg,#e2b65c 1px,transparent 1px);background-size:96px 96px}
.top{position:absolute;left:84px;top:170px;width:920px;font-family:"Archivo","Segoe UI",sans-serif;font-weight:800;color:#f5f8f4}
.eyebrow{font-family:"JetBrains Mono","Consolas",monospace;letter-spacing:.36em;font-size:27px;color:#e2b65c;text-transform:uppercase;margin-bottom:44px;font-weight:400}
.line{font-size:104px;line-height:1.08;margin-bottom:14px;opacity:0;transform:translateY(24px)}
.low{position:absolute;left:84px;top:1545px;width:920px;font-family:"Archivo","Segoe UI",sans-serif;font-weight:800}
.low .line{color:#e2b65c;font-size:62px;line-height:1.14;margin-bottom:34px}
.stage{position:absolute;left:0;top:660px;width:1080px;height:840px}
.dev{position:absolute;opacity:0;background:#0b100d;box-shadow:0 40px 90px -30px rgba(0,0,0,.9),0 0 0 2px #2a3a31,0 0 0 9px #141c17}
.dev img{display:block;width:100%;height:100%;object-fit:cover;object-position:top;background:#f3f5f1}
#laptop{left:150px;top:30px;width:860px;height:538px;border-radius:20px;padding:13px}
#laptop img{border-radius:8px}
#base{position:absolute;left:84px;top:581px;width:992px;height:24px;border-radius:0 0 26px 26px;background:linear-gradient(#26342c,#141c17);opacity:0;box-shadow:0 30px 60px -20px rgba(0,0,0,.9)}
#tablet{left:44px;top:300px;width:366px;height:520px;border-radius:28px;padding:14px;z-index:2}
#tablet img{border-radius:14px}
#phone{left:806px;top:330px;width:230px;height:490px;border-radius:36px;padding:10px;z-index:3}
#phone img{border-radius:24px}
</style>
<div class="card"><div class="grid"></div>
<div class="top"><div class="eyebrow">One guide, every screen</div>
<div class="line" id="l0">On your phone.</div><div class="line" id="l1">On your laptop.</div><div class="line" id="l2">On your tablet.</div></div>
<div class="stage"><div class="dev" id="laptop"><img src="{LAPTOP}"></div><div id="base"></div>
<div class="dev" id="tablet"><img src="{TABLET}"></div><div class="dev" id="phone"><img src="{PHONE}"></div></div>
<div class="low"><div class="line" id="l3">Updated as regulations and policies change.</div><div class="line" id="l4">Free. No app store.</div></div>
</div>
<script>
window.__anim = p => {
  const fade = (el, t0, len, rise) => { const q = Math.min(1, Math.max(0, (p - t0) / len)); el.style.opacity = q; el.style.transform = 'translateY(' + ((rise || 24) * (1 - q)) + 'px)'; return q; };
  fade(l0, 0.03, 0.08); fade(l1, 0.19, 0.08); fade(l2, 0.35, 0.08); fade(l3, 0.53, 0.08); fade(l4, 0.78, 0.08);
  fade(phone, 0.03, 0.10, 50); base.style.opacity = fade(laptop, 0.19, 0.10, 50); base.style.transform = laptop.style.transform; fade(tablet, 0.35, 0.10, 50);
  document.querySelector('.stage').style.transform = 'translateY(' + (Math.sin(p * 6.283) * 6) + 'px)';
};
</script>
"""
def img64(path): return "data:image/png;base64," + base64.b64encode(open(path, "rb").read()).decode()
PAGE = "<!doctype html><html><head><meta charset='utf-8'><style>%s html,body{margin:0;width:%dpx;height:%dpx;overflow:hidden;background:#070d0a}</style></head><body>%s</body></html>"

def seg_phone(r, page, ax):   # 9.6 s composite: five lines, and the guide on a phone, a laptop and a tablet
    r.seg("phone"); keep = r.page; r.page = ax
    src = os.path.join(ROOT, "device_src")
    body = EVERY_HTML
    for k in ("phone", "laptop", "tablet"): body = body.replace("{" + k.upper() + "}", img64(os.path.join(src, k + ".png")))
    ax.set_content(PAGE % (FONTS, CW, CH, body))
    ax.wait_for_timeout(500); ax.evaluate("document.fonts.ready.then(() => 1)"); ax.wait_for_timeout(200)
    r.anim(9.6, lambda p: f"__anim({p:.4f})")
    r.page = keep

def card_push(r, ax, png_name, seconds, z0=1.0, z1=1.06):
    keep = r.page; r.page = ax
    b64 = base64.b64encode(open(os.path.join(CARDS, png_name + ".png"), "rb").read()).decode()
    ax.set_content(PAGE % ("", CW, CH, "<img id='__card' src='data:image/png;base64," + b64 + "' style='position:fixed;left:0;top:0;width:100vw;height:100vh;transform-origin:50% 50%;will-change:transform'>"))
    ax.wait_for_timeout(400)
    r.anim(seconds, lambda p: f"document.getElementById('__card').style.transform = 'scale({z0 + (z1 - z0) * p:.5f})'")
    r.page = keep

def seg_c_open(r, page, ax):  r.seg("c_open");  card_push(r, ax, "card_open", 4.8, 1.0, 1.03)
def seg_c_title(r, page, ax): r.seg("c_title"); card_push(r, ax, "card_title", 4.8, 1.0, 1.06)
def seg_c_end(r, page, ax):   r.seg("c_end");   card_push(r, ax, "card_end", 11.2, 1.0, 1.07)

SEGS = {n: globals()["seg_" + n] for n in ORDER}
AUX_SEGS = {"phone", "c_open", "c_title", "c_end"}
PRE = {"setup": pre_setup}

def pick_seeds(page):
    """Print, for a run of seeds, the first Quick 10 question each would bring (to choose a short one for the phone screen)."""
    rows = page.evaluate("""(() => { const out = []; const all = CORB.data.questions();
      for (let s = 1; s <= 80; s++) { __seed(s); const q = CORB.util.shuffle(all)[0]; const right = q.options.find(o => o.correct) || {};
        out.push([s, q.stem.length, Math.max(...q.options.map(o => String(o.text).length)), String(right.why || '').length, q.stem, String(right.text)]); }
      return out; })()""")
    for s in sorted(rows, key=lambda x: x[1] + 2 * x[2] + x[3] / 3)[:14]: print("  seed", s, flush=True)

def main():
    todo = RESUME.split(",") if ONLY else ORDER[ORDER.index(RESUME):] if RESUME and RESUME != "seeds" else ORDER
    if not RESUME:
        if os.path.exists(ROOT): shutil.rmtree(ROOT)
    os.makedirs(ROOT, exist_ok=True)
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(C.PORT), "--directory", C.DOCS, "--bind", "127.0.0.1"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1.0)
    try:
        with sync_playwright() as p:
            br = p.chromium.launch(channel="msedge", headless=True, args=["--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
            if "phone" in todo and RESUME != "seeds": device_shots(br)
            ctx = br.new_context(viewport={"width": W, "height": H}, device_scale_factor=DPR, is_mobile=True, has_touch=True, user_agent=UA)
            ctx.add_init_script(INIT)
            actx = br.new_context(viewport={"width": CW, "height": CH}, device_scale_factor=1); actx.add_init_script(INIT)
            page = ctx.new_page(); errs = []; page.on("pageerror", lambda e: errs.append(str(e)[:200]))
            page.set_default_timeout(30000)
            page.goto(C.URL + "#/home", wait_until="load", timeout=120000); page.wait_for_timeout(2000)
            r = Rec(page); r.js(C.SETUP); r.js(TOUCH); r.settle(60)
            if RESUME == "seeds": pick_seeds(page); br.close(); return
            ax = actx.new_page(); ax.set_content(PAGE % ("", CW, CH, "")); ax.wait_for_timeout(200)
            if RESUME:
                mp = os.path.join(ROOT, "manifest.json")
                if os.path.exists(mp): r.segs = [s for s in json.load(open(mp))["segments"] if s["name"] not in todo]
            t = time.time(); page.screenshot(type="jpeg", quality=C.Q); print(f"screenshot cost {time.time()-t:.2f}s at DPR {DPR}; capturing {todo}", flush=True)
            for name in todo:
                if name in PRE: PRE[name](r, page)
                if name in AUX_SEGS: SEGS[name](r, page, ax)
                else: SEGS[name](r, page)
                r.save()
            print("frames:", r.n, "| segments:", ", ".join(f"{s['name']}={sum(d for _, d in s['frames']):.1f}s" for s in r.segs))
            print("pageerrors:", errs[:5]); br.close()
    finally:
        srv.terminate()

if __name__ == "__main__":
    main()
