import json
from pathlib import Path


folder = Path(__file__).resolve().parent
pages_path = folder / "pages.json"
fixes_path = folder / "page_text_fixes.json"

pages = json.loads(pages_path.read_text(encoding="utf-8"))
by_page = {item["page"]: item for item in pages}
fixes = json.loads(fixes_path.read_text(encoding="utf-8"))

for fix in fixes:
    page_number = fix["page"]
    if page_number not in by_page:
        raise SystemExit(f"Missing page {page_number}")
    page = by_page[page_number]
    if "title" in fix:
        page["title"] = fix["title"]
    # A fully verified body is the canonical value for this page.  Assigning it
    # directly keeps corrective runs idempotent, including fixes that add
    # footnote markers or notes whose original text remains inside the result.
    if "body" in fix:
        page["body"] = fix["body"]
        continue
    for replacement in fix.get("replacements", []):
        old = replacement["from"]
        new = replacement["to"]
        if old not in page["body"]:
            if new in page["body"]:
                continue
            raise SystemExit(f"Expected text was not found on page {page_number}: {old}")
        page["body"] = page["body"].replace(old, new, 1)

pages_path.write_text(
    json.dumps(pages, ensure_ascii=False, indent=2),
    encoding="utf-8",
)
print(f"Applied verified text fixes to {len(fixes)} page(s).")
