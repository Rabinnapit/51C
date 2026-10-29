"""Probe: screenshot every screen the teaser plans to use, at 1920x1080, from the web edition served locally.
Usage: python probe.py <outdir>
"""
import json, os, subprocess, sys, time
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__)); REPO = os.path.dirname(os.path.dirname(HERE))
DOCS = os.path.join(REPO, "docs"); PORT = 8797
OUT = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else "../probe"); os.makedirs(OUT, exist_ok=True)
TERMS = json.load(open(os.path.join(REPO, "src", "data", "meta.json"), encoding="utf-8"))["terms"]["version"]

INIT = """
try { localStorage.setItem('b2b.installAsked', String(Date.now()));
  localStorage.setItem('b2b.state.v1', JSON.stringify({version:'b2b-state-1', settings:{termsAccepted:'%s', tourSeen:true}, meta:{updatedAt:new Date().toISOString()}})); } catch(e) {}
""" % TERMS

def main():
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--directory", DOCS, "--bind", "127.0.0.1"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1.0)
    try:
        with sync_playwright() as p:
            br = p.chromium.launch(channel="msedge", headless=True, args=["--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
            ctx = br.new_context(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)
            ctx.add_init_script(INIT)
            page = ctx.new_page(); errs = []; page.on("pageerror", lambda e: errs.append(str(e)[:200]))
            page.on("console", lambda m: errs.append("console." + m.type + ": " + m.text[:160]) if m.type in ("error",) else None)
            page.goto(f"http://127.0.0.1:{PORT}/#/home", wait_until="load", timeout=60000); page.wait_for_timeout(1500)
            def shot(name, wait=600):
                page.wait_for_timeout(wait); page.screenshot(path=os.path.join(OUT, name + ".png")); print("shot", name, flush=True)
            shot("01_home")
            print("gl:", page.evaluate("(() => { const c = document.createElement('canvas'); const g = c.getContext('webgl2') || c.getContext('webgl'); if(!g) return 'none'; const d = g.getExtension('WEBGL_debug_renderer_info'); return d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'webgl ok'; })()"))
            # setup via the UI
            page.click(".setup-form .choice"); page.wait_for_timeout(200)
            shot("02_setup", 200)
            page.click("text=Build my plan"); page.wait_for_timeout(1200)
            shot("03_path_after_setup")
            for name, hsh in [("04_plan", "#/plan"), ("05_cert_overview", "#/cert"), ("06_cert_exam", "#/cert?tab=exam"), ("07_official", "#/official"),
                              ("08_learn", "#/learn"), ("09_lesson_L01", "#/lesson?id=L01"), ("10_quiz", "#/quiz"), ("11_cards", "#/cards"),
                              ("12_arcade", "#/arcade"), ("13_glossary", "#/glossary"), ("14_far", "#/far"), ("15_howto", "#/howto"), ("16_courses", "#/courses"), ("17_about", "#/about")]:
                page.goto(f"http://127.0.0.1:{PORT}/{hsh}"); page.wait_for_timeout(900); shot(name, 300)
            # quiz running
            page.goto(f"http://127.0.0.1:{PORT}/#/quiz?start=quick"); page.wait_for_timeout(1200); shot("18_quiz_run")
            opts = page.query_selector_all(".opt, button.opt, .options button")
            print("quiz options found:", len(opts))
            if opts: opts[1].click(); shot("19_quiz_answered", 800)
            # flashcards: open a deck
            page.goto(f"http://127.0.0.1:{PORT}/#/cards"); page.wait_for_timeout(900)
            dk = page.query_selector_all(".decks .card, .decks a, .decks button"); print("decks:", len(dk))
            if dk: dk[0].click(); page.wait_for_timeout(900); shot("20_cards_study")
            # buddy
            page.evaluate("CORB.buddy.open()"); page.wait_for_timeout(500); shot("21_buddy_open")
            page.evaluate("CORB.buddy.ask('When can I take the exam?')"); page.wait_for_timeout(900); shot("22_buddy_answer")
            page.evaluate("CORB.buddy.close()")
            # arcade: lobby then Range Day
            page.goto(f"http://127.0.0.1:{PORT}/#/arcade"); page.wait_for_timeout(1500); shot("23_arcade_lobby")
            ok = page.evaluate("ARCADE._debug.play('range-day')"); print("range-day play:", ok)
            page.wait_for_timeout(2500); page.evaluate("ARCADE._debug.start()"); page.wait_for_timeout(2500); shot("24_range_day")
            page.wait_for_timeout(3000); shot("25_range_day_b")
            print("range state:", page.evaluate("(() => { const r = ARCADE._debug.run(); return r ? {ended: r.ended, paused: r.paused, score: r.score, W: r.W, H: r.H} : null; })()"))
            page.evaluate("ARCADE._debug.play('contract-quest')"); page.wait_for_timeout(2000); page.evaluate("ARCADE._debug.start()"); page.wait_for_timeout(2500); shot("26_contract_quest")
            # phone-sized install page and home
            mctx = br.new_context(viewport={"width": 412, "height": 915}, device_scale_factor=2, is_mobile=True, has_touch=True,
                                  user_agent="Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36")
            mctx.add_init_script(INIT); mp = mctx.new_page()
            mp.goto(f"http://127.0.0.1:{PORT}/?install=1", wait_until="load"); mp.wait_for_timeout(1500); mp.screenshot(path=os.path.join(OUT, "30_phone_install.png")); print("shot phone install")
            mp.goto(f"http://127.0.0.1:{PORT}/#/home"); mp.wait_for_timeout(1200); mp.screenshot(path=os.path.join(OUT, "31_phone_home.png"))
            mp.goto(f"http://127.0.0.1:{PORT}/#/learn"); mp.wait_for_timeout(1200); mp.screenshot(path=os.path.join(OUT, "32_phone_learn.png"))
            mp.goto(f"http://127.0.0.1:{PORT}/#/arcade"); mp.wait_for_timeout(1500); mp.screenshot(path=os.path.join(OUT, "33_phone_arcade.png"))
            print("errors:", errs[:8])
            br.close()
    finally:
        srv.terminate()

if __name__ == "__main__":
    main()
