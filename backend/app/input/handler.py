"""Input layer: intake only. No inference, no interpretation."""

from __future__ import annotations

import json
import xml.etree.ElementTree as ET

from bs4 import BeautifulSoup

from app.schemas.models import ContentType, InputResult


def process_input(content: str, content_type: ContentType) -> InputResult:
    """Intake raw content. Validate well-formedness. No interpretation."""
    size = len(content.encode("utf-8"))
    parse_errors: list[str] = []
    parse_status = "ok"

    if content_type == ContentType.xml:
        try:
            ET.fromstring(content)
        except ET.ParseError as e:
            parse_status = "error"
            parse_errors.append(f"XML parse error: {e}")

    elif content_type == ContentType.html:
        try:
            soup = BeautifulSoup(content, "html.parser")
            if not soup.find():
                parse_errors.append("HTML contains no recognizable elements")
                parse_status = "error"
        except Exception as e:
            parse_status = "error"
            parse_errors.append(f"HTML parse error: {e}")

    elif content_type == ContentType.json:
        try:
            json.loads(content)
        except json.JSONDecodeError as e:
            parse_status = "error"
            parse_errors.append(f"JSON parse error: {e}")

    elif content_type == ContentType.text:
        if not content.strip():
            parse_status = "error"
            parse_errors.append("Empty text content")

    return InputResult(
        raw_content=content,
        content_type=content_type.value,
        size=size,
        parse_status=parse_status,
        parse_errors=parse_errors,
    )
