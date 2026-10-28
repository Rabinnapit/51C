"""Render the official PDFs that B2B Guide carries inside the file into small page images.

  python tools/render_official.py ["<folder with the official PDFs>"]

The folder defaults to "B2B Exam Prep_Resources/Official DPCAP and WarU documents" next to this repository.
PDFs stay out of git (.gitignore); the page images in src/official/ are committed and tools/build.py embeds
them, so the Official documents view can show the real pages offline.

Text pages become 4 grey levels and colour pages a small palette, both saved as lossless WebP: sharp text at
about 40 KB a page. Needs PyMuPDF (fitz) and Pillow. The ids must match "id" in src/data/official.json.
"""
import io, sys
from pathlib import Path

import fitz
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "src" / "official"

# id, file name as published, page width in pixels, mode (g4 = 4 grey levels, cN = N-colour palette per page or "page:mode")
DOCS = [
    ("exam-roadmap", "CON 3990V User Experience Roadmap (As_of_11 May_2026).pdf", 1000, "g4", {5: "c32"}),
    ("exam-flowchart", "CON 3990V User Experience Roadmap Flowchart (June 2026).pdf", 1800, "c32", {}),
    ("exam-faq", "CON_Certification_Exam_FAQs_(As_of_01_Oct_2026).pdf", 1000, "g4", {}),
    ("fy27-change", "USA001296-26-DPCAP Certification Change FY27 (Jun 2026).pdf", 1000, "g4", {}),
    ("career-model", "DoW Contracting Career Field Model (Mar 2026).pdf", 2200, "c48", {}),
    ("competency-model", "DoD_Contracting_Competency_Model_(November_2024).pdf", 1500, "g4", {}),
    ("reciprocity-faq", "Reciprocity MOU FAQs (Aug 2025).pdf", 1000, "g4", {}),
    ("cl-recommendations", "USA000183-25-DPCAP Workforce Development and CL Recommendations 2025.pdf", 1000, "g4", {}),
]


def render(page, width, mode):
    zoom = width / page.rect.width
    pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=False)
    img = Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")
    if mode == "g4":
        img = img.convert("L").quantize(colors=4, dither=Image.Dither.NONE).convert("L")
    else:
        img = img.quantize(colors=int(mode[1:]), method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGB")
    buf = io.BytesIO()
    img.save(buf, "WEBP", lossless=True, method=6, quality=100)
    return buf.getvalue()


def main():
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "B2B Exam Prep_Resources" / "Official DPCAP and WarU documents"
    if not src.is_dir():
        raise SystemExit(f"PDF folder not found: {src}\nPass the folder that holds the official PDFs.")
    OUT.mkdir(parents=True, exist_ok=True)
    total = 0
    for doc_id, name, width, mode, per_page in DOCS:
        pdf = src / name
        if not pdf.exists():
            raise SystemExit(f"missing {name} in {src}")
        for old in OUT.glob(f"{doc_id}-*.webp"):
            old.unlink()
        doc = fitz.open(pdf)
        sizes = []
        for n, page in enumerate(doc, 1):
            data = render(page, width, per_page.get(n, mode))
            (OUT / f"{doc_id}-{n}.webp").write_bytes(data)
            sizes.append(len(data))
        total += sum(sizes)
        print(f"{doc_id:20} {len(sizes)} pages  {sum(sizes) // 1024} KB")
    print(f"total {total // 1024} KB in {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
