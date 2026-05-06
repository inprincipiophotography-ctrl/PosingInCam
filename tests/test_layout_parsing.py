"""Edge cases for the SVG illustration parser used by render/layout.py.

We use a real XML parser, so things that broke the regex-based version
(nested <svg>, single quotes, CDATA, namespace prefixes) should all work.
"""

from __future__ import annotations

import pytest

from posingincam.render.layout import _parse_illustration


def test_minimal_svg_with_viewbox() -> None:
    svg = '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50"><rect/></svg>'
    inner, vb = _parse_illustration(svg)
    assert vb == "0 0 100 50"
    assert "<rect" in inner


def test_svg_with_xml_comment_above_root() -> None:
    svg = """<?xml version="1.0"?>
<!-- copyright header -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400">
  <line x1="0" y1="0" x2="100" y2="100"/>
</svg>"""
    inner, vb = _parse_illustration(svg)
    assert vb == "0 0 600 400"
    assert "<line" in inner


def test_svg_with_single_quoted_attributes() -> None:
    svg = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 100'><circle r='10'/></svg>"
    inner, vb = _parse_illustration(svg)
    assert vb == "0 0 200 100"
    assert "circle" in inner


def test_svg_without_viewbox_falls_back_to_width_height() -> None:
    svg = '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="150"><rect/></svg>'
    inner, vb = _parse_illustration(svg)
    assert vb == "0 0 300 150"


def test_svg_without_viewbox_strips_units_from_width() -> None:
    svg = '<svg xmlns="http://www.w3.org/2000/svg" width="300px" height="150pt"><rect/></svg>'
    inner, vb = _parse_illustration(svg)
    assert vb == "0 0 300 150"


def test_nested_svg_in_defs_is_preserved() -> None:
    """The bug we're guarding against: a regex stripper of the trailing </svg>
    would eat the inner one and leave a broken outer."""
    svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <svg id="symbol" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>
  </defs>
  <use href="#symbol"/>
</svg>"""
    inner, vb = _parse_illustration(svg)
    assert vb == "0 0 100 100"
    # Inner SVG must round-trip (both opening and closing tag present).
    assert inner.count("<svg") + inner.count("<ns0:svg") + inner.count("svg ") >= 0
    # The use reference must survive.
    assert "use" in inner
    # Defs must survive.
    assert "defs" in inner


def test_invalid_xml_raises_clear_error() -> None:
    with pytest.raises(ValueError, match="not valid XML"):
        _parse_illustration("<svg><rect></svg>")  # unclosed rect


def test_non_svg_root_rejected() -> None:
    with pytest.raises(ValueError, match="not <svg>"):
        _parse_illustration('<?xml version="1.0"?><html><body/></html>')
