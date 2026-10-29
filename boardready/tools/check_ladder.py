"""Check Threshold Run items: correct_class must match value_number under Army Warranting Program Policy v12
Table 1 with the current SAT and commercial simplified-procedures (SaP) ceiling, using the same classifier the game uses.

  python tools/check_ladder.py [path-to-json]     (default: content/out/games_levels_threshold_ladder.json)
"""
import json, re, sys
from pathlib import Path

APP = Path(__file__).resolve().parents[1]
reg = json.loads((APP / "src" / "data" / "regulations.json").read_text(encoding="utf-8"))
thr = {t.get("id"): t.get("value_number") for t in reg.get("thresholds", [])}
SAT = thr.get("sat") or 350_000
SAP = thr.get("sap_commercial_ceiling") or 9_000_000


def classify(value, commercial):
    if value <= SAT:
        return "I"
    if value <= 5_000_000:
        return "II"
    if commercial and value <= SAP:
        return "II"
    if value <= 100_000_000:
        return "III"
    return "IV"


def money_values(text):
    """Dollar amounts written as $1,234,567 / $2.5M / $750K in a fact line."""
    out = []
    for m in re.finditer(r"\$\s?([\d,]+(?:\.\d+)?)\s*(million|billion|m|b|k)?\b", text, flags=re.I):
        n = float(m.group(1).replace(",", ""))
        unit = (m.group(2) or "").lower()
        n *= {"million": 1e6, "m": 1e6, "billion": 1e9, "b": 1e9, "k": 1e3}.get(unit, 1)
        out.append(n)
    return out


path = Path(sys.argv[1]) if len(sys.argv) > 1 else APP / "content" / "out" / "games_levels_threshold_ladder.json"
data = json.loads(path.read_text(encoding="utf-8-sig"))
items = data["threshold_ladder"] if isinstance(data, dict) else data
bad, notes = [], []
for it in items:
    blob = (str(it.get("label", "")) + " " + " ".join(str(f) for f in (it.get("facts") or []))).lower()
    non_commercial = bool(re.search(r"non-?commercial|not (a )?commercial|sap does not apply|simplified procedures do not apply", blob))
    commercial = (not non_commercial) and "commercial" in blob and bool(re.search(r"simplified|\bsap\b|12\.201|13\.5", blob))
    value = it.get("value_number") or 0
    want = classify(value, commercial)
    if want != it.get("correct_class"):
        bad.append((it.get("id"), value, it.get("correct_class"), want, "commercial SaP" if commercial else "", it.get("label")))
    amounts = money_values(" ".join(str(f) for f in (it.get("facts") or [])))
    if amounts and value and not any(abs(a - value) < 1 for a in amounts) and abs(sum(amounts) - value) > 1:
        notes.append((it.get("id"), value, amounts[:6], it.get("label")))
    if it.get("difficulty") not in (1, 2, 3):
        bad.append((it.get("id"), value, it.get("correct_class"), "missing difficulty", "", it.get("label")))

print(f"{path.name}: {len(items)} items; difficulty 1/2/3 = "
      + "/".join(str(sum(1 for x in items if x.get("difficulty") == d)) for d in (1, 2, 3))
      + f"; SAT ${SAT:,.0f}; SaP ${SAP:,.0f}")
print(f"class or difficulty problems: {len(bad)}")
for b in bad:
    print("  ", b)
print(f"facts whose dollar figures do not obviously add up to value_number (read these by hand): {len(notes)}")
for n in notes:
    print("  ", n)
sys.exit(1 if bad else 0)
