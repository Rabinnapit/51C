"""Dated content patches applied on top of the merged content.

  python tools/content_patches.py      patches src/data/*.json in place (no source spreadsheet needed)

tools/merge_content.py also calls apply() just before it writes src/data, so a future merge from the source lists and
content/out keeps these changes: they live in one place, here, instead of in both content/out and src/data.
Each patch is dated and names its source. Add new patches at the end of PATCHES; never edit an applied one.
"""
import json
import sys
from pathlib import Path

APP = Path(__file__).resolve().parents[1]
DATA = APP / "src" / "data"


def _by(items, key, value):
    for it in items:
        if it.get(key) == value:
            return it
    return None


def _ensure(items, key, value, record):
    """Append record unless an item with the same key already exists; return the item."""
    it = _by(items, key, value)
    if it is None:
        items.append(record)
        return record
    return it


# ---------------------------------------------------------------- 29 October 2026
def patch_2026_10_29(mods):
    """Re-check of the official sources on 29 Oct 2026 (docs/PLAN-1.2.md): FAR overhaul rulemaking status, DoD class
    deviations, CAS thresholds now in force, the Army 8(a) competition memo, Department of War and WarU naming."""
    regs = mods.get("regulations")
    if isinstance(regs, dict):
        ups = regs.setdefault("updates", [])
        for u in [
            {"id": "rfo-status-2026-10", "date": "2026-10-29", "title": "Where the FAR overhaul stands", "status": "verify",
             "text": "The RFO numbering has governed FAR, DFARS and AFARS practice since 1 February 2026 through class deviations (Army Warranting Program Policy v12). Formal rulemaking is under way: the FAR Council published its first proposed rules on 23 June 2026 (20 parts) and a second batch on 18 September 2026 (Parts 8, 9, 12, 13, 14, 15, 16, 17, 27, 28, 35, 36, 38, 44, 47 and 51 with their Part 52 clauses; comments closed 19 October 2026). No final rule had been published by 29 October 2026, so the deviation text still governs and the citations in this app stand. Part 19 (small business) is expected in a later batch.",
             "url": "https://www.acquisition.gov/far-overhaul",
             "source": "acquisition.gov/far-overhaul (page updated 26 Oct 2026); the Federal Register notices as reported by Wiley Rein, Nextgov and Washington Technology, September 2026. Secondary reports: confirm against the Federal Register before quoting a date in the board."},
            {"id": "dod-deviations-2026-10", "date": "2026-10-29", "title": "DoD class deviations since the September check", "status": "verify",
             "text": "2026-O0025 Revision 3 (3 September 2026) implements RFO FAR Part 40, information security and supply-chain security, in the DFARS. 2024-O0006 Revision 2 (7 October 2026) revises the prohibition on Russian fossil fuel business operations. Nothing new on warrants, justification and approval tiers, protests, claims or debriefings.",
             "url": "https://www.acq.osd.mil/dpap/dars/class_deviations.html",
             "source": "DPCAP class deviations page, read 29 Oct 2026"},
            {"id": "cas-in-force-2026-10", "date": "2026-10-01", "title": "CAS thresholds now in force", "status": "verified",
             "text": "Since 1 October 2026 the Cost Accounting Standards applicability threshold is $35 million and full coverage starts at $100 million (CAS Board final rule, 91 FR 56056; DFARS 230.201-70 per Class Deviation 2026-O0006 Rev. 1). The old $7.5 million trigger exemption no longer exists.",
             "url": "https://www.federalregister.gov/documents/2026/09/01/2026-17901/increase-of-monetary-thresholds-and-other-matters-related-to-cost-accounting-standards-program",
             "source": "91 FR 56056 (published 1 Sep 2026, effective 1 Oct 2026), read in September"},
            {"id": "army-8a-competition-2026-04", "date": "2026-04-07", "title": "Army preference for competition in the 8(a) program", "status": "verify",
             "text": "An ASA(ALT) memorandum signed by the Deputy Assistant Secretary of the Army (Procurement) on 7 April 2026 directs Army contracting activities to use competitive procedures as the preference over 8(a) sole source to the maximum extent practicable. Emergency acquisitions under FAR Part 18 are not barred, and small business sole-source and set-aside awards above $20 million go to a senior-level review. Statutory sole-source authority for Alaska Native Corporations, tribes and Native Hawaiian Organizations is unchanged. Added to the small-business primer; confirm the memo on PAM before citing it.",
             "url": "", "source": "Schwabe, Williamson & Wyatt summary of the memorandum (secondary source); the memo itself is on PAM"},
        ]:
            _ensure(ups, "id", u["id"], u)
        th = _by(regs.get("thresholds") or [], "id", "cas_applicability")
        if th:
            th["value"] = "$35,000,000 (since 1 Oct 2026)"
            th["applies"] = "governmentwide (statute); contracts and subcontracts awarded on or after 1 Oct 2026 (before that: $2,500,000, TINA-linked)"
            th["notes"] = (th.get("notes") or "") + " Update 29 Oct 2026: the rule is now in force; the board answer is the single $35 million applicability threshold."
        th = _by(regs.get("thresholds") or [], "id", "cas_trigger_exemption")
        if th:
            th["value"] = "Eliminated 1 Oct 2026 (was $7,500,000)"
            th["applies"] = "no longer in force: removed by 91 FR 56056 effective 1 Oct 2026; the single $35 million applicability threshold replaced it"
            th["notes"] = (th.get("notes") or "") + " Update 29 Oct 2026: eliminated; keep only as history."
        regs["verified_on"] = "2026-10-29"
        notes = regs.get("notes")
        note = "29 Oct 2026: acquisition.gov/far-overhaul and the DPCAP class deviations page re-checked; thresholds unchanged apart from the CAS rows; the PAM-hosted Army policy and AFARS not re-checked (CAC needed)."
        if isinstance(notes, list):
            notes.append(note)
        elif isinstance(notes, str):
            regs["notes"] = (notes + " " if notes else "") + note
        else:
            regs["notes"] = note

    gl = mods.get("glossary")
    if isinstance(gl, list):
        _ensure(gl, "term", "DoW", {"term": "DoW", "expansion": "Department of War",
            "definition": "The name the Department of Defense has used since the September 2025 executive order that allowed 'Department of War' as its secondary title: the Secretary of War, the Office of the Assistant Secretary of War, and DPCAP memos issued in that name. Statutes (title 10), the DFARS title and most regulation text still say 'Department of Defense' and 'DoD', so both names are correct in a board answer; say which document you are quoting.",
            "domain": "General Contracting", "cite": "DoW rollout memo for the RFO class deviations, 19 Dec 2025 (acq.osd.mil)"})
        _ensure(gl, "term", "WarU", {"term": "WarU", "expansion": "Warfighting Acquisition University (formerly DAU)",
            "definition": "The current name of the Defense Acquisition University: waru.edu replaces dau.edu, and ACQuipedia, the contracting certification courses (CON 1100V to CON 7300V) and the FAR overhaul training live there. Older decks and policy memos still say DAU.",
            "domain": "General Contracting", "cite": "waru.edu"})
        _ensure(gl, "term", "8(a) competition preference", {"term": "8(a) competition preference", "expansion": "ASA(ALT) memorandum of 7 April 2026",
            "definition": "Army policy signed by the DASA(P): Army contracting activities using the SBA 8(a) Business Development Program use competitive procedures as the preference over sole source to the maximum extent practicable. Emergency acquisitions under FAR Part 18 are not barred, and small business sole-source and set-aside awards above $20 million go to a senior-level review. The statutory sole-source authority of Alaska Native Corporations, tribes and Native Hawaiian Organizations is unchanged. Confirm the memo on PAM before citing it.",
            "domain": "Small Business & Socioeconomic", "cite": "ASA(ALT) memorandum, 7 Apr 2026 (secondary source: Schwabe summary); verify on PAM"})

    pr = mods.get("primers")
    if isinstance(pr, list):
        sb = _by(pr, "id", "small-business")
        if sb and not _by(sb.get("sections") or [], "heading", "Army preference for competition in 8(a) (April 2026)"):
            sb.setdefault("sections", []).append({"heading": "Army preference for competition in 8(a) (April 2026)",
                "body": "On 7 April 2026 the Assistant Secretary of the Army (Acquisition, Logistics and Technology) issued a memorandum, signed by the Deputy Assistant Secretary of the Army (Procurement), directing Army contracting activities that use the SBA 8(a) program to use competitive procedures as the preference over sole source procedures to the maximum extent practicable. Two points matter in the board room: the memo does not bar sole-source awards under the emergency authorities of FAR Part 18, and it sends small business sole-source and set-aside awards above $20 million to a senior-level review. It cannot change the statute, so the unlimited sole-source authority Congress gave Alaska Native Corporations, tribes and Native Hawaiian Organizations stays. If a board member asks how you would place an 8(a) requirement, start with competition among 8(a) firms and explain what would justify sole source. The summary here is from a law-firm report of the memo; read the memo on PAM before you quote a figure."})
            sb.setdefault("board_angles", []).append("Since April 2026 the Army prefers competitive 8(a) procedures; an 8(a) sole source needs a reason, and awards above $20 million get a senior-level review (confirm the memo on PAM).")
        wp = _by(pr, "id", "warrant-program")
        if wp and not _by(wp.get("sections") or [], "heading", "Where the FAR overhaul stands (October 2026)"):
            wp.setdefault("sections", []).append({"heading": "Where the FAR overhaul stands (October 2026)",
                "body": "Cite RFO numbering: the Army Warranting Program Policy v12 made the overhauled FAR, DFARS and AFARS effective in Army practice on 1 February 2026, through class deviations. The FAR Council is now writing the same text into the FAR itself: proposed rules for 20 parts were published on 23 June 2026 and a second batch (Parts 8, 9, 12, 13, 14, 15, 16, 17, 27, 28, 35, 36, 38, 44, 47 and 51, with their Part 52 clauses) on 18 September 2026, each with a 30-day comment period. No final rule had been published by 29 October 2026, so the deviation text still governs. A board member who asks 'is the RFO final?' wants to hear exactly that: in effect by deviation, in formal rulemaking, not yet final. Check acquisition.gov/far-overhaul for the current state before your board."})

    rs = mods.get("resources")
    if isinstance(rs, list):
        for r in rs:
            t = r.get("title") or ""
            if t.startswith("DAU (WARU) home"):
                r["title"] = "WarU (Warfighting Acquisition University, formerly DAU) home - dau.edu redirects to waru.edu"
            elif t.startswith("DAU (WARU) ACQuipedia"):
                r["title"] = "WarU ACQuipedia - defense acquisition encyclopedia (formerly DAU)"

    meta = mods.get("meta")
    if isinstance(meta, dict):
        meta["content_verified_on"] = "2026-10-29"
        meta.setdefault("board_rule", {"week": 2, "weekday": 3})
        src = meta.setdefault("sources", [])
        line = "Re-check of 29 October 2026: acquisition.gov/far-overhaul and the DPCAP class deviations page; the Army policy and AFARS on PAM were not re-checked (CAC needed)"
        if line not in src:
            src.append(line)


PATCHES = [patch_2026_10_29]


def apply(mods):
    """mods: {module name: object}. Each patch edits in place and skips what it already did."""
    for fn in PATCHES:
        fn(mods)
    return mods


if __name__ == "__main__":
    names = ["regulations", "glossary", "primers", "resources", "meta"]
    mods = {}
    for n in names:
        p = DATA / f"{n}.json"
        if p.exists():
            mods[n] = json.loads(p.read_text(encoding="utf-8"))
    apply(mods)
    for n, obj in mods.items():
        p = DATA / f"{n}.json"
        raw = p.read_bytes()
        crlf = b"\r\n" in raw
        indent = 2 if n == "meta" else 1
        text = json.dumps(obj, ensure_ascii=False, indent=indent) + ("\n" if raw.endswith(b"\n") else "")
        if crlf:
            text = text.replace("\n", "\r\n")
        p.write_text(text, encoding="utf-8", newline="")
        print(f"patched src/data/{n}.json")
    sys.exit(0)
