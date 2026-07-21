from pathlib import Path
import fitz

folder = Path(r"C:\Users\Test2\Downloads\zamzami")
pdf_path = folder / "poems.pdf"
out_dir = folder / "page_images"
out_dir.mkdir(exist_ok=True)

doc = fitz.open(str(pdf_path))
for i, page in enumerate(doc):
    out_file = out_dir / f"page_{i+1:03d}.png"
    if out_file.exists():
        continue
    pix = page.get_pixmap(dpi=200)
    pix.save(str(out_file))
    if (i + 1) % 20 == 0:
        print(f"rendered {i+1}/{len(doc)}")
print("DONE", len(doc))
