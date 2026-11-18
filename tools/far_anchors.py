"""Point every FAR citation in the content at its exact section and paragraph on the RFO part page.

  python tools/far_anchors.py              download the cited RFO part pages (each once, then from the cache),
                                           write src/data/far_anchors.json and print a report
  python tools/far_anchors.py --list       only list the FAR citations found in src/data/*.json (no network)
  python tools/far_anchors.py --refresh    download the part pages again (do this when the RFO is revised)
  python tools/far_anchors.py --cache DIR  keep the downloaded pages in DIR (default: <system temp>/b2b-rfo-cache;
                                           never inside this repository)

FAR citations in the app open the RFO (Revolutionary FAR Overhaul) part page
https://www.acquisition.gov/far-overhaul/far-part-deviation-guide/far-overhaul-part-N (data.citeUrl in
src/js/core/04-data.js). The pages carry ids for the part, each subpart and each section (FAR_Part_15,
FAR_Subpart_15_4, FAR_1_102, FAR_15_404_1, FAR_52_212_4: dots and dashes become underscores), but none for
paragraphs: a paragraph is a <p class="ListL2"> whose first child is <span class="ph autonumber">(4)</span>, nested
by ListL1/ListL2/ListL3..., and a run-in label such as "(b)" can stand alone with its "(1)" child after it. So a
paragraph citation goes to its section id plus a text fragment made of the paragraph's opening words:
  .../far-overhaul-part-1#FAR_1_102:~:text=In%20this%20spirit%2C%20acquisition%20team

src/data/far_anchors.json maps each cited reference, written as in the content minus "RFO " and "FAR " with
whitespace collapsed ("1.102(b)(4)", "15.404-1", "3.2" for a subpart cited without the word, "Subpart 15.4",
"Part 15"), to {"p": part number, "id": "FAR_1_102" | "FAR_Subpart_15_4" | "FAR_Part_15", "t": "opening words"},
one entry per line.

"t" is there for a paragraph citation: the fewest of the paragraph's first 5 to 9 words (up to 20 when the page
repeats the first nine; all of them when there are fewer than 5) that appear nowhere else on the page, without the
label, cut at a word boundary, trailing commas, colons and dashes dropped. When no prefix is unique, "t" is the
shortest one whose first match on the page is that paragraph (a browser jumps to the first match). A run-in label
with no words of its own ("(b)" then "(1) ..."), or a heading-like paragraph whose words occur earlier on the page
("(a) General."), takes its first child's words; only if that fails too does "t" include the label ("(b) Policy.").
The app should percent-encode "t" including "-" (encodeURIComponent leaves "-" alone; text fragments reserve it).

Sections are found by the number in their heading, not by id alone, because some pages carry wrong ids: Part 10 has
no FAR_Part_10 and uses FAR_10_001 twice (first on a wrapper around the whole part), Part 37 writes FAR_37_201-2, and
Parts 17, 37 and 43 have ids that belong to other headings. An entry takes the id the page really uses; a section
citation whose id does not land on the section (FAR_10_001) also gets "t" from the section's first paragraph.

A part, subpart, section or paragraph the RFO page does not have gets no entry, so the app keeps linking to the top of
the part page. The report lists each one with where it is used: content to fix in src/data, or old FAR numbers
quoted on purpose (which the app links all the same). Citations are found with the app's CITE_RE
(src/js/core/03-ui.js), mirrored below. Standard library only (urllib, html.parser).
"""
import argparse, json, re, sys, tempfile, time, urllib.error, urllib.request
from collections import namedtuple
from datetime import datetime
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src" / "data"
OUT = DATA / "far_anchors.json"
PAGE_URL = "https://www.acquisition.gov/far-overhaul/far-part-deviation-guide/far-overhaul-part-{}"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
PAUSE = 1.5                                 # seconds between two downloads
MIN_WORDS, MAX_WORDS, LONGEST = 5, 9, 20    # opening words: 5 to 9, up to 20 only when the page repeats the first nine

SECTION_SIGN, NBSP = chr(0xA7), chr(0xA0)
# CITE_RE from src/js/core/03-ui.js in Python terms ([0-9] for \d, an ASCII look-behind for \b), plus an optional "RFO "
CITE_RE = re.compile(
    r"(?<![A-Za-z0-9_])(?:RFO\s+)?("
    r"(?:DFARS\s+PGI|AFARS\s+PGI|PGI|FAR|DFARS|AFARS)\s+(?:Part\s+|Subpart\s+)?[0-9]{1,4}(?:\.[0-9]{1,4})?(?:-[0-9]{1,3})*(?:\([a-zA-Z0-9]{1,4}\))*"
    r"|[0-9]{1,2}\s+U\.S\.C\.\s+(?:" + SECTION_SIGN + r"\s*)?[0-9]{3,5}[a-z]?"
    r"|[0-9]{1,2}\s+CFR\s+(?:" + SECTION_SIGN + r"\s*)?[0-9]{1,4}(?:\.[0-9]+)?"
    r"|DoDI\s+[0-9]{4}\.[0-9]{2,3})")
REF_RE = re.compile(r"(?:(Part|Subpart) )?([0-9]{1,4})(?:\.([0-9]{1,4}))?((?:-[0-9]{1,3})*)((?:\([a-zA-Z0-9]{1,4}\))*)")
HEAD_NUM = re.compile(r"(Part [0-9]+|Subpart [0-9]+\.[0-9]+|[0-9]+\.[0-9]+(?:-[0-9]+)*)(?![0-9.-])")   # "15.404-1 Price..."
SECTION_NUM = re.compile(r"[0-9]+\.[0-9]+(?:-[0-9]+)*")
ID_NUM = re.compile(r"FAR_([0-9]+)_([0-9]+)((?:[_-][0-9]+)*)")                                     # "FAR_15_404_1"
LABEL = re.compile(r"\(([A-Za-z0-9]{1,6})\)")
LEVEL = re.compile(r"\bListL([0-9]+)\b")
WS = re.compile(r"\s+")                     # Python's \s takes in the no-break space, as a browser's find does
INVISIBLE = re.compile("[" + "".join(map(chr, (0xAD, 0x200B, 0x200C, 0x200D, 0x2060, 0xFEFF))) + "]")
TRAIL = " ,;:-([{/\"'" + "".join(map(chr, (0x2013, 0x2014, 0x201C, 0x2018)))   # dropped from the end of "t"

# tags that start a new line of text: a text fragment never matches across them
BLOCK = set("address article aside blockquote body br caption dd details dialog div dl dt fieldset figcaption figure footer "
            "form h1 h2 h3 h4 h5 h6 header hgroup hr html legend li main menu nav ol option p pre section summary table "
            "tbody td tfoot th thead tr ul".split())
ENDS_P = set("address article aside blockquote details div dl fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 "
             "header hgroup hr main menu nav ol p pre section table ul".split())
SKIP = {"script", "style", "noscript", "template", "title"}
HEADINGS = {"h1", "h2", "h3", "h4", "h5", "h6"}

Ref = namedtuple("Ref", "kind part anchor number labels")   # kind: part, subpart, section or para


# ---------------------------------------------------------------- citations in the content

def strings(obj, path="", ident=""):
    """Every string in a JSON value with where it sits: ((path, nearest id), text)."""
    if isinstance(obj, str):
        yield (path, ident), obj
    elif isinstance(obj, list):
        for i, x in enumerate(obj):
            yield from strings(x, f"{path}[{i}]", ident)
    elif isinstance(obj, dict):
        ident = str(obj.get("id") or obj.get("term") or ident)
        for k, v in obj.items():
            yield from strings(v, f"{path}.{k}" if path else k, ident)


def context(s, a, b, room=45):
    """A few words either side of s[a:b], on one line."""
    lo, hi = max(0, a - room), min(len(s), b + room)
    if lo > 0:
        lo = s.find(" ", lo, a) + 1 or lo
    if hi < len(s):
        cut = s.rfind(" ", b, hi)
        hi = cut if cut > b else hi
    return ("..." if lo > 0 else "") + WS.sub(" ", s[lo:hi]).strip() + ("..." if hi < len(s) else "")


def norm_key(cite):
    """'RFO FAR  1.102(b)(4)' -> '1.102(b)(4)'; 'FAR Subpart 15.4' -> 'Subpart 15.4'. The app must do the same."""
    s = WS.sub(" ", cite).strip()
    s = re.sub(r"^RFO ", "", s)
    return re.sub(r"^FAR ", "", s)


def collect():
    """Every FAR citation in src/data/*.json: {key: [(file, (path, id), context), ...]} in first-seen order."""
    found = {}
    for f in sorted(DATA.glob("*.json")):
        if f.name == OUT.name:
            continue
        obj = json.loads(f.read_text(encoding="utf-8"))
        for where, s in strings(obj):
            for m in CITE_RE.finditer(s):
                if m.group(1).startswith("FAR"):
                    found.setdefault(norm_key(m.group(0)), []).append((f.name, where, context(s, m.start(), m.end())))
    return found


def parse_ref(key):
    """'1.102(b)(4)' -> Ref('para', 1, 'FAR_1_102', '1.102', ['b', '4']); '15.4' and 'Subpart 15.4' -> a subpart.
    Two digits or fewer after the dot make a subpart (3.2, 42.11); three or more a section (3.104, 42.1101)."""
    m = REF_RE.fullmatch(key)
    if not m:
        return None
    word, part, sub, dashes, paras = m.groups()
    n, labels = int(part), LABEL.findall(paras)
    plain = not dashes and not labels
    if word == "Part" or (word is None and sub is None):
        return Ref("part", n, f"FAR_Part_{n}", f"Part {n}", []) if sub is None and plain else None
    if sub is None:
        return None
    if word == "Subpart" or len(sub) <= 2:
        return Ref("subpart", n, f"FAR_Subpart_{n}_{sub}", f"Subpart {n}.{sub}", []) if len(sub) <= 2 and plain else None
    number = f"{n}.{sub}{dashes}"
    return Ref("para" if labels else "section", n, "FAR_" + number.replace(".", "_").replace("-", "_"), number, labels)


def fmt_path(path):
    return "".join(f"({x})" for x in path)


def id_number(anchor):
    """'FAR_15_404_1' (or the Part 37 page's 'FAR_37_201-2') -> '15.404-1'; None for other ids."""
    m = ID_NUM.fullmatch(anchor)
    return f"{m.group(1)}.{m.group(2)}" + m.group(3).replace("_", "-") if m else None


# ---------------------------------------------------------------- RFO part pages

def fetch(n, cache, refresh, clock):
    """The HTML of RFO part n, from the cache or the website (PAUSE seconds after the last download)."""
    f = cache / f"far-overhaul-part-{n}.html"
    if f.exists() and not refresh:
        text = f.read_bytes().decode("utf-8", errors="replace")
        if is_part_page(text, n):
            return text, "cache " + datetime.fromtimestamp(f.stat().st_mtime).strftime("%Y-%m-%d")
    wait = clock[0] - time.time()
    if wait > 0:
        time.sleep(wait)
    req = urllib.request.Request(PAGE_URL.format(n), headers={
        "User-Agent": UA, "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8", "Accept-Language": "en-US,en;q=0.9"})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                raw, charset = r.read(), r.headers.get_content_charset() or "utf-8"
            break
        except urllib.error.HTTPError as e:
            if e.code < 500 or attempt == 2:
                raise
        except (urllib.error.URLError, TimeoutError, ConnectionError):
            if attempt == 2:
                raise
        finally:
            clock[0] = time.time() + PAUSE
        time.sleep(5 * (attempt + 1))
    text = raw.decode(charset, errors="replace")
    if not is_part_page(text, n):
        raise ValueError(f"the page that came back has no FAR_{n}_... ids (a block or error page?)")
    cache.mkdir(parents=True, exist_ok=True)
    tmp = f.with_suffix(".tmp")
    tmp.write_bytes(text.encode("utf-8"))
    tmp.replace(f)
    return text, "downloaded"


def is_part_page(text, n):
    """True for an RFO part page. Not every page carries its own part id (the Part 10 page says FAR_Part_1)."""
    return f'id="FAR_Part_{n}"' in text or re.search(f'id="FAR_(?:Subpart_)?{n}_[0-9]', text) is not None


class Art:
    """An open <article>: its id, its heading, the FAR number the heading starts with, and whether it is the first
    element on the page with its id (a link to #id goes to the first)."""
    __slots__ = ("id", "head", "number", "first")

    def __init__(self, ident, first):
        self.id, self.head, self.number, self.first = ident, None, None, first


class Para:
    __slots__ = ("section", "level", "start", "end", "label", "raw", "reading_label", "path", "own")

    def __init__(self, section, level, start):
        self.section, self.level, self.start, self.end = section, level, start, start
        self.label = self.raw = self.own = ""
        self.reading_label, self.path = True, None


class RfoPage(HTMLParser):
    """One RFO part page: its ids, the article each heading number belongs to, its text as a browser searches it
    (one line per block, whitespace collapsed), and every labelled paragraph of each section with its label path,
    e.g. ('b', '4'). Sections are keyed by the number in their heading ('15.404-1'), which beats a wrong id."""

    def __init__(self, html_text):
        super().__init__(convert_charrefs=True)
        self.out, self.size, self.last = [], 0, "\n"
        self.ids, self.skip = {}, 0             # ids: id -> how many elements carry it
        self.articles, self.waiting, self.head = [], [], None   # open articles; those still waiting for a heading
        self.by_number = {}                     # 'Part 15' / 'Subpart 15.4' / '15.404-1' -> first Art with an id headed so
        self.first_head = {}                    # id -> heading of the first article with that id
        self.first_text = {}                    # section number -> its first paragraph with words
        self.para, self.spans, self.paras = None, [], []
        self.stack, self.stack_sec = [], None
        self.notes = []                         # (section number or None, message)
        self.feed(html_text)
        self.close()
        self.close_para()
        if any(a.id for a in self.articles):
            self.notes.append((None, f"<article> elements left open at the end: {[a.id for a in self.articles if a.id][:5]}"))
        self.text = "".join(self.out)
        low = self.text.lower()
        self.low = low if len(low) == len(self.text) else "".join(c.lower() if len(c.lower()) == 1 else c for c in self.text)
        self.by_section = {}
        for p in self.paras:
            self.by_section.setdefault(p.section, []).append(p)

    # page text
    def put(self, s):
        s = WS.sub(" ", INVISIBLE.sub("", s))
        if s[:1] == " " and self.last in " \n":
            s = s[1:]
        if s:
            self.out.append(s)
            self.size += len(s)
            self.last = s[-1]

    def brk(self):
        if self.last != "\n":
            self.out.append("\n")
            self.size += 1
            self.last = "\n"

    # parser events
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        i = a.get("id")
        if i:
            self.ids[i] = self.ids.get(i, 0) + 1
        if tag in HEADINGS and self.waiting and self.head is None:
            self.head = []
        if tag in SKIP:
            self.skip += 1
            return
        if tag in ENDS_P:
            self.close_para()
        if tag in BLOCK:
            self.brk()
        if tag == "article":
            art = Art(i or "", bool(i) and self.ids[i] == 1)
            self.articles.append(art)
            self.waiting.append(art)
        elif tag == "p":
            self.open_para(a.get("class") or "")
        elif tag == "span" and self.para is not None:
            self.spans.append("autonumber" in (a.get("class") or "").split())

    def handle_endtag(self, tag):
        if tag in SKIP:
            self.skip = max(0, self.skip - 1)
            return
        if tag in HEADINGS and self.head is not None:
            text = WS.sub(" ", "".join(self.head)).strip()
            m = HEAD_NUM.match(text)
            for art in self.waiting:
                art.head, art.number = text, m.group(1) if m else None
                if art.first:
                    self.first_head[art.id] = text
                if art.number and art.id and art.number not in self.by_number:
                    self.by_number[art.number] = art    # the first article with an id (Drupal wraps the part in id-less ones)
            self.waiting, self.head = [], None
        if tag == "span" and self.para is not None:
            if self.spans:
                self.spans.pop()
        elif tag in BLOCK and tag != "br":
            self.close_para()
            if tag == "article" and self.articles:
                art = self.articles.pop()
                if art in self.waiting:
                    self.waiting.remove(art)
        if tag in BLOCK:
            self.brk()

    def handle_data(self, data):
        if self.skip:
            return
        self.put(data)
        if self.head is not None:
            self.head.append(data)
        p = self.para
        if p is None:
            return
        if p.reading_label and any(self.spans):
            p.label += data                 # a label can come in pieces: "(", <em>"1"</em>, ")"
        else:
            if data.strip():
                p.reading_label = False
            p.raw += data

    # paragraphs
    def open_para(self, cls):
        """A <p> belongs to the section whose article is innermost around it. The section number comes from the
        article's heading, else its id; an article headed "Part 10" (the Part 10 page's wrapper) is no section."""
        self.close_para()
        art = next((x for x in reversed(self.articles) if x.id.startswith("FAR_") or x.number), None)
        number = (art.number or id_number(art.id)) if art else None
        m = LEVEL.search(cls)
        self.para = Para(number if number and SECTION_NUM.fullmatch(number) else None, int(m.group(1)) if m else None, self.size)
        self.spans = []

    def close_para(self):
        p, self.para, self.spans = self.para, None, []
        if p is None or not p.section:
            return
        p.end = self.size
        p.own = WS.sub(" ", INVISIBLE.sub("", p.raw)).strip()
        if p.own and p.section not in self.first_text:
            self.first_text[p.section] = p
        label = WS.sub("", p.label)
        if not label:
            return                          # unlabelled text (lead-in lines, definitions) is not a citable paragraph
        comps = LABEL.findall(label)
        if not comps or LABEL.sub("", label):
            self.notes.append((p.section, f"paragraph label {label!r} not understood; skipped"))
            return
        if p.level is None:
            self.notes.append((p.section, f"paragraph {label} has no ListL level class; skipped"))
            return
        if p.section != self.stack_sec:
            self.stack, self.stack_sec = [], p.section
        if p.level - 1 > len(self.stack):
            self.notes.append((p.section, f"paragraph {label} at level {p.level} follows {fmt_path(self.stack) or 'no paragraph'}"))
            self.stack += ["?"] * (p.level - 1 - len(self.stack))
        self.stack = self.stack[:p.level - 1] + comps      # "(b)(1)" at ListL1 sets two levels at once
        p.path = tuple(self.stack)
        self.paras.append(p)

    # lookups
    def locate(self, number):
        """(id, lands) for 'Part 15', 'Subpart 15.4' or '15.404-1': the id of the first article headed by that number
        and whether a link to #id lands on it (no earlier element has the id); (None, False) if no heading has it."""
        art = self.by_number.get(number)
        return (art.id, art.first) if art else (None, False)

    def find(self, section, path):
        """The paragraph whose words a citation of section+path should show, and how it was found:
        'own' (its own text), 'child' (a run-in label: its first child's text), or (None, None)."""
        paras = self.by_section.get(section, [])
        exact = next((i for i, p in enumerate(paras) if p.path == path), None)
        if exact is not None and paras[exact].own:
            return paras[exact], "own"
        k = len(path)
        for p in paras[(exact or 0):]:
            if len(p.path) > k and p.path[:k] == path and p.own:
                return p, "child"
        return None, None

    def child_of(self, para):
        """The first paragraph under para (its path begins with para's path) that has words, if para has children."""
        paras, k = self.by_section.get(para.section, []), len(para.path)
        for p in paras[next(i for i, x in enumerate(paras) if x is para) + 1:]:
            if len(p.path) <= k or p.path[:k] != para.path:
                return None
            if p.own:
                return p
        return None

    def nearest(self, section, path):
        """For a paragraph the page lacks: the deepest cited level that exists and the labels under it."""
        paras = self.by_section.get(section, [])
        for d in range(len(path) - 1, -1, -1):
            kids = []
            for p in paras:
                if len(p.path) > d and p.path[:d] == path[:d] and p.path[d] not in kids:
                    kids.append(p.path[d])
            if kids:
                return path[:d], kids
        return (), []

    def hits(self, snippet, limit=3):
        """Where a browser's text-fragment search finds snippet: case-insensitive, starting and ending on a word
        boundary, within one block (the page text has a line break between blocks)."""
        s, out, low = snippet.lower(), [], self.low
        word = lambda c: c.isalnum() or c == "_"
        i = low.find(s)
        while i >= 0 and len(out) < limit:
            j = i + len(s)
            if not (word(s[0]) and i > 0 and word(low[i - 1])) and not (word(s[-1]) and j < len(low) and word(low[j])):
                out.append(i)
            i = low.find(s, i + 1)
        return out


def opening_words(page, para, with_label=False):
    """The fewest opening words of para (5 to 9; up to LONGEST when the page repeats the first nine; all of them when
    there are fewer than 5) that a browser finds in para before anywhere else on the page: (text, 'unique') when
    they occur once, (text, 'first') when they recur later, else (None, None). with_label reads "(b) Policy." whole."""
    words = page.text[para.start:para.end].split() if with_label else para.own.split(" ")
    first = None
    for k in [len(words)] if len(words) <= MIN_WORDS else range(MIN_WORDS, min(len(words), LONGEST) + 1):
        raw = " ".join(words[:k])
        # trailing punctuation off first; kept if that helps, but never a final "-" (the text-fragment prefix mark)
        for s in dict.fromkeys((raw.rstrip(TRAIL), raw.rstrip(" -"))):
            h = page.hits(s) if s else []
            if h and para.start <= h[0] < para.end:
                if len(h) == 1:
                    return s, "unique"
                if first is None:
                    first = s
    return (first, "first") if first else (None, None)


def paragraph_words(page, para):
    """'t' for a cited paragraph: (text, how, paragraph the words come from, label included). Its own words first;
    else its first child's (a heading-like "(a) General." whose word occurs earlier); else its label and words."""
    t, how = opening_words(page, para)
    if t:
        return t, how, para, False
    child = page.child_of(para)
    if child:
        t, how = opening_words(page, child)
        if t:
            return t, how, child, False
    t, how = opening_words(page, para, with_label=True)
    return t, how, para, True


# ---------------------------------------------------------------- report helpers

def where_str(file, where, ctx):
    path, ident = where
    return f"{file} {path}" + (f" (id {ident})" if ident and ident not in path else "") + f': "{ctx}"'


def list_labels(kids):
    shown = [f"({k})" for k in kids]
    return " ".join(shown) if len(shown) <= 8 else f"{shown[0]} to {shown[-1]} ({len(shown)} labels)"


def sort_key(item):
    key, ref = item
    rank = {"part": 0, "subpart": 1}.get(ref.kind, 2) if ref else 3
    return (ref.part if ref else 999, rank, [int(t) if t.isdigit() else t for t in re.split(r"(\d+)", key)])


# ---------------------------------------------------------------- main

def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--cache", type=Path, default=Path(tempfile.gettempdir()) / "b2b-rfo-cache",
                    help="folder for the downloaded RFO part pages (default: %(default)s)")
    ap.add_argument("--refresh", action="store_true", help="download the part pages again even if they are cached")
    ap.add_argument("--list", action="store_true", help="only list the FAR citations found; no network")
    args = ap.parse_args()
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(errors="replace")

    cites = collect()
    refs = {k: parse_ref(k) for k in cites}
    ordered = sorted(refs.items(), key=sort_key)
    uses = sum(len(v) for v in cites.values())
    if args.list:
        for key, ref in ordered:
            print(f"{key:<24} {ref.kind if ref else '??':<8} {ref.anchor if ref else '':<22} {len(cites[key])}x  {cites[key][0][0]}")
        print(f"{len(cites)} different FAR citations, {uses} uses")
        return 0

    # pages
    need = sorted({r.part for r in refs.values() if r and 1 <= r.part <= 53})
    pages, got, clock = {}, {}, [0.0]
    for n in need:
        try:
            html_text, how = fetch(n, args.cache, args.refresh, clock)
        except Exception as e:  # noqa: BLE001 - report and stop; a partial file would drop links that work today
            print(f"ERROR part {n}: {PAGE_URL.format(n)} could not be read: {e}")
            print(f"Nothing written. Pages already downloaded are kept in {args.cache}; run again to resume.")
            return 1
        got[n] = how
        pages[n] = RfoPage(html_text)

    # resolve
    entries, problems = {}, []          # problems: (key, message)
    count = {k: [0, 0] for k in ("part", "subpart", "section", "para")}     # [cited, found]
    notes = {"child": [], "first": [], "label": [], "no_t": [], "long": [], "nbsp": [], "page": []}
    for key, ref in ordered:
        if ref is None:
            problems.append((key, "not a FAR number this tool understands (Part N, Subpart N.N, N.N, N.NNN, N.NNN-N, then (x) labels)"))
            continue
        count[ref.kind][0] += 1
        if not 1 <= ref.part <= 53:
            problems.append((key, f"the RFO has no Part {ref.part} page (parts are 1 to 53)"))
            continue
        page = pages[ref.part]
        section = ref.number if ref.kind in ("section", "para") else None
        aid, lands = page.locate(ref.number)
        if ref.kind == "part":
            count["part"][1] += 1
            if aid != ref.anchor or not lands:  # a page defect; the plain part link opens the same place anyway
                notes["page"].append(f"{key}: the Part {ref.part} page has no usable id {ref.anchor} (its part heading "
                                     f"sits in {aid or 'no article'}); no entry, so the app keeps the plain part link")
                continue
        elif aid is None:
            what = ref.number if ref.kind == "subpart" else f"section {ref.number}"
            msg = f"{what} is not on the RFO Part {ref.part} page"
            if ref.anchor in page.ids:
                msg += f" (the page uses the id {ref.anchor} for \"{page.first_head.get(ref.anchor, '?')}\")"
            problems.append((key, msg))
            continue
        else:
            count[ref.kind][1] += ref.kind != "para"
            if aid != ref.anchor:
                notes["page"].append(f"{key}: the page's id for {ref.number} is {aid}, not {ref.anchor}; the entry uses {aid}")
            if not lands:
                notes["page"].append(f"{key}: the page has the id {aid} {page.ids[aid]} times and the first is on "
                                     f"\"{page.first_head.get(aid, '?')}\", so #{aid} alone does not land on {ref.number}")
        entry = {"p": ref.part, "id": aid}
        if ref.kind == "section" and not lands and section in page.first_text:
            t, how_t = opening_words(page, page.first_text[section])
            if t:
                entry["t"] = t
                notes["page"][-1] += f"; the section entry gets its first paragraph's words as \"t\": {t}"
        if ref.kind == "para":
            path = tuple(ref.labels)
            para, how = page.find(section, path)
            if para is None:            # no entry: the app keeps the plain part link, as it does today
                have, kids = page.nearest(section, path)
                if kids:
                    msg = f"{section}{fmt_path(have)} has {list_labels(kids)}, no {fmt_path(path[len(have):len(have) + 1])}"
                else:
                    msg = f"section {section} has no lettered or numbered paragraphs"
                problems.append((key, f"paragraph {fmt_path(path)} is not in section {section}: {msg}"))
                continue
            t, how_t, used, with_label = paragraph_words(page, para)
            if not t:
                notes["no_t"].append(key)
            else:
                entry["t"] = t
                count["para"][1] += 1
                if how == "child":
                    notes["child"].append(f"{key}: no words of its own (a run-in label); 't' is from {section}{fmt_path(used.path)}")
                elif used is not para:
                    notes["child"].append(f"{key}: its own words (\"{para.own}\") occur earlier on the page; 't' is from {section}{fmt_path(used.path)}")
                if with_label:
                    notes["label"].append(f"{key}: \"{t}\"" + (" (unique)" if how_t == "unique" else " (the first of several matches)"))
                elif how_t == "first":
                    notes["first"].append(f"{key}: \"{t}\"")
                if len(t.split(" ")) > MAX_WORDS:
                    notes["long"].append(f"{key}: {len(t.split(' '))} words")
                toks = re.split(r"[ \t\r\n\f\v]+", used.raw.strip(" \t\r\n\f\v"))
                if any(NBSP in x for x in toks[:len(t.split(" "))]):
                    notes["nbsp"].append(key)
        entries[key] = entry

    # write: one entry per line, compact
    lines = [json.dumps(k, ensure_ascii=False) + ":" + json.dumps(v, ensure_ascii=False, separators=(",", ":"))
             for k, v in entries.items()]
    # the cited numbers the RFO pages do not have (old FAR numbers quoted on purpose: the old-to-new table, the class
    # material notes): the app shows them as plain text instead of a link into a page where they are not
    missing = sorted(k for k, msg in problems if " is not on the RFO " in msg or " is not in section " in msg)
    lines.append(json.dumps("_missing") + ":" + json.dumps(missing, ensure_ascii=False, separators=(",", ":")))
    OUT.write_text("{\n" + ",\n".join(lines) + "\n}\n", encoding="utf-8")
    json.loads(OUT.read_text(encoding="utf-8"))

    # report
    from_cache = sum(1 for v in got.values() if v.startswith("cache"))
    print(f"FAR citations: {len(cites)} different, {uses} uses, in src/data/*.json")
    print(f"RFO part pages: {len(need)} ({len(need) - from_cache} downloaded, {from_cache} from {args.cache})")
    for k, label in (("part", "parts"), ("subpart", "subparts"), ("section", "sections"), ("para", "paragraphs")):
        c, f = count[k]
        print(f"  {label:<11} {c:>4} cited, {f:>4} found on the RFO page" + (" (with opening words)" if k == "para" else ""))
    print(f"Wrote {OUT.relative_to(ROOT).as_posix()}: {len(entries)} entries, {OUT.stat().st_size / 1024:.1f} KB")

    print(f"\nNOT ON THE RFO PAGES ({len(problems)}): no entry written (the app keeps the plain part link); review in src/data")
    if not problems:
        print("  none")
    for key, msg in problems:
        print(f"  FAR {key}: {msg}")
        for file, where, ctx in cites[key][:6]:
            print(f"      {where_str(file, where, ctx)}")
        if len(cites[key]) > 6:
            print(f"      ... and {len(cites[key]) - 6} more uses")

    print("\nCAVEATS")
    explain = {
        "child": "cited paragraphs whose 't' comes from their first child paragraph (lands just below the label)",
        "label": "cited paragraphs whose 't' had to include the label",
        "first": "opening words that recur later on the page (an Alternate, a twin paragraph); the first match is the cited one",
        "long": "more than 9 words were needed to be unique on the page",
        "nbsp": "'t' crosses a no-break space on the page (written as a plain space; browsers match it)",
        "no_t": "paragraph found but no usable opening words; the entry links to the section only",
        "page": "defects on the RFO pages themselves (missing, misplaced or repeated ids)",
    }
    any_note, other, cited = False, 0, {r.number for r in refs.values() if r and r.kind == "para"}
    for k, text in explain.items():
        if notes[k]:
            any_note = True
            print(f"  {len(notes[k])} {text}:")
            for x in notes[k]:
                print(f"      {x}")
    for n in need:
        mine = [(sec, msg) for sec, msg in pages[n].notes if sec is None or sec in cited]
        for sec, msg in mine:
            any_note = True
            print(f"  part {n} page, {sec or 'whole page'}: {msg}")
        other += len(pages[n].notes) - len(mine)
    if other:
        any_note = True
        print(f"  {other} page-structure oddities (level jumps, odd labels) in sections with no paragraph citation; they change no link")
    if not any_note:
        print("  none")
    return 0


if __name__ == "__main__":
    sys.exit(main())
