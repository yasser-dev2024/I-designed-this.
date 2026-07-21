import json
from pathlib import Path

folder = Path(r"C:\Users\Test2\Downloads\zamzami")
pages_path = folder / "pages.json"
batch_path = folder / "batch_corrections.json"

pages = json.load(open(pages_path, encoding="utf-8"))
by_page = {p["page"]: p for p in pages}

batch = json.load(open(batch_path, encoding="utf-8"))
for item in batch:
    pn = item["page"]
    if pn in by_page:
        by_page[pn]["title"] = item["title"]
        by_page[pn]["body"] = item["body"]
    else:
        pages.append({"page": pn, "title": item["title"], "body": item["body"]})

pages.sort(key=lambda p: p["page"])
pages_path.write_text(json.dumps(pages, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"Applied {len(batch)} corrections. Total pages: {len(pages)}")
