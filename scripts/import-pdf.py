import argparse
import json
import re
from datetime import date
from pathlib import Path

import fitz


def to_slug(value: str) -> str:
    value = re.sub(r"\.[^.]+$", "", value.lower().strip())
    value = re.sub(r"[^\w\u4e00-\u9fff]+", "-", value, flags=re.UNICODE)
    value = value.strip("-")[:80]
    return value or "imported-pdf"


def yaml_string(value) -> str:
    return '"' + str(value or "").replace("\\", "\\\\").replace('"', '\\"') + '"'


def yaml_array(values) -> str:
    return "[" + ", ".join(yaml_string(value) for value in values) + "]"


def read_upload_metadata(post_dir: Path) -> dict:
    try:
        data = json.loads((post_dir / "upload.json").read_text(encoding="utf-8"))
        return {
            "title": str(data.get("title") or ""),
            "date": str(data.get("date") or ""),
            "category": str(data.get("category") or ""),
            "tags": [str(tag) for tag in data.get("tags", []) if str(tag).strip()],
            "summary": str(data.get("summary") or ""),
        }
    except FileNotFoundError:
        return {}


def clean_text(text: str) -> str:
    lines = [line.rstrip() for line in text.replace("\r\n", "\n").replace("\r", "\n").split("\n")]
    blocks = []
    current = []
    for line in lines:
        if line.strip():
            current.append(line.strip())
        elif current:
            blocks.append(" ".join(current))
            current = []
    if current:
        blocks.append(" ".join(current))
    return "\n\n".join(blocks)


def unique_name(base: str, used: set[str]) -> str:
    stem = re.sub(r"[^A-Za-z0-9._-]+", "-", Path(base).stem).strip("-") or "pdf-image"
    suffix = Path(base).suffix.lower() or ".png"
    candidate = f"{stem}{suffix}"
    index = 2
    while candidate.lower() in used:
        candidate = f"{stem}-{index}{suffix}"
        index += 1
    used.add(candidate.lower())
    return candidate


def import_pdf(input_path: Path, slug: str, title_arg: str) -> Path:
    post_dir = Path("content") / "posts" / slug
    post_dir.mkdir(parents=True, exist_ok=True)
    metadata = read_upload_metadata(post_dir)
    title = metadata.get("title") or title_arg or input_path.stem
    published_date = metadata.get("date") or date.today().isoformat()
    category = metadata.get("category") or "技术"
    tags = metadata.get("tags") or ["PDF", "写作"]
    summary = metadata.get("summary") or f"从 {input_path.name} 导入的文章，图片已抽取到同名目录。"

    doc = fitz.open(input_path)
    used_names = {"index.md", "source.pdf", "upload.json"}
    seen_xrefs = {}
    sections = []
    image_index = 0

    for page_index, page in enumerate(doc, start=1):
        page_blocks = [f"## 第 {page_index} 页"]
        text = clean_text(page.get_text("text") or "")
        if text:
            page_blocks.append(text)

        for image in page.get_images(full=True):
            xref = image[0]
            if xref in seen_xrefs:
                filename = seen_xrefs[xref]
            else:
                image_index += 1
                extracted = doc.extract_image(xref)
                extension = extracted.get("ext") or "png"
                filename = unique_name(f"pdf-image-{image_index:02d}.{extension}", used_names)
                (post_dir / filename).write_bytes(extracted["image"])
                seen_xrefs[xref] = filename
            page_blocks.append(f"![PDF 第 {page_index} 页图片](./{filename})")

        sections.append("\n\n".join(page_blocks))

    body = f"""---
title: {yaml_string(title)}
date: {published_date}
category: {yaml_string(category)}
tags: {yaml_array(tags)}
summary: {yaml_string(summary)}
source: "pdf"
---

{chr(10).join(section + chr(10) for section in sections).strip()}
"""
    output = post_dir / "index.md"
    output.write_text(body, encoding="utf-8")
    return output


def main() -> None:
    parser = argparse.ArgumentParser(description="Import a PDF into a Null Observatory post.")
    parser.add_argument("input")
    parser.add_argument("--slug", default="")
    parser.add_argument("--title", default="")
    args = parser.parse_args()

    input_path = Path(args.input).resolve()
    slug = args.slug or to_slug(input_path.name)
    output = import_pdf(input_path, slug, args.title)
    print(f"Imported {input_path}")
    print(f"Post: {output.resolve()}")


if __name__ == "__main__":
    main()
