#!/usr/bin/env python3
"""
Scale all coordinates in an SVG by a uniform factor and rewrite the viewBox.

svg2pdc.py uses the SVG's viewBox (or width/height) as the PDC's native size,
but doesn't apply `transform="scale(...)"`.  To produce a 72x72 PDC from a
Twemoji 36x36 source, every coordinate inside the SVG needs to be doubled
before conversion.

Handles all numeric tokens in:
  * <path d="...">         path command coordinates
  * <circle cx, cy, r>     center + radius

Usage:
    python3 scale_svg.py in.svg out.svg [factor]
"""

import re
import sys
from xml.etree import ElementTree as ET

NUMBER_RE = re.compile(r"[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?")


def scale_attr_numbers(value: str, factor: float) -> str:
    """Multiply every number in a string by `factor`. Always emits a space
    after each replaced number so that adjacent SVG-compact tokens like
    "30.312.276" (two numbers without separator) don't fuse into a single
    ambiguous "60.624.552" after scaling."""

    def repl(m: re.Match) -> str:
        n = float(m.group(0)) * factor
        if n == int(n):
            s = str(int(n))
        else:
            # Avoid float artifacts like 18.000000000000004 — use 6 decimals.
            s = f"{n:.6f}".rstrip("0").rstrip(".")
        # Trailing space guarantees a separator between adjacent numbers.
        # Multiple spaces are collapsed below.
        return s + " "

    out = NUMBER_RE.sub(repl, value)
    # Collapse runs of whitespace introduced by the trailing-space trick.
    return re.sub(r"\s+", " ", out).strip()


def flatten_curves(d_str: str, samples: int = 12) -> str:
    """Parse a path's d attribute, expand every CubicBezier / QuadraticBezier /
    Arc into `samples` short line segments. Lines, Moves and Closes pass
    through unchanged.

    svg2pdc.py captures only the start point of each path segment; for
    paths made of a small number of long Bezier arcs (e.g. a crescent
    moon = 3 arcs), the result collapses into a triangle of vertices.
    Pre-flattening to a polyline gives svg2pdc enough vertices to render
    a smooth-looking shape."""
    try:
        import svg.path
        path = svg.path.parse_path(d_str)
    except Exception:
        return d_str

    def fmt(c):
        return f"{c.real:g} {c.imag:g}"

    parts = []
    for seg in path:
        name = seg.__class__.__name__
        if name == "Move":
            parts.append(f"M {fmt(seg.end)}")
        elif name == "Line":
            parts.append(f"L {fmt(seg.end)}")
        elif name == "Close":
            parts.append("Z")
        elif name in ("CubicBezier", "QuadraticBezier", "Arc"):
            for i in range(1, samples + 1):
                t = i / samples
                parts.append(f"L {fmt(seg.point(t))}")
        else:
            # Unknown segment type — drop it rather than corrupt the path.
            pass
    return " ".join(parts)


def scale_svg(src_path: str, dst_path: str, factor: float) -> None:
    # Preserve the default SVG namespace on serialize.
    ET.register_namespace("", "http://www.w3.org/2000/svg")

    tree = ET.parse(src_path)
    root = tree.getroot()

    # Rewrite viewBox = "min-x min-y width height" → scale width / height.
    vb = root.get("viewBox")
    if vb:
        parts = vb.strip().split()
        if len(parts) == 4:
            x, y, w, h = (float(p) for p in parts)
            root.set("viewBox", f"{x:g} {y:g} {w * factor:g} {h * factor:g}")

    # Strip width/height attributes (we want viewBox to drive sizing).
    root.attrib.pop("width", None)
    root.attrib.pop("height", None)

    # Walk and scale every supported geometry attribute.
    coord_attrs = {"cx", "cy", "r", "rx", "ry", "x", "y", "x1", "y1", "x2", "y2",
                   "width", "height", "points"}
    for el in root.iter():
        if el.tag.endswith("}path") or el.tag == "path":
            d = el.get("d")
            if d:
                d = scale_attr_numbers(d, factor)
                # svg2pdc only samples the START of each path segment, so a
                # crescent moon made of three big Bezier arcs renders as a
                # triangle. Flatten every Bezier/Arc into N short line
                # segments so svg2pdc gets enough vertices. 6 samples is
                # smooth enough at 72-px and keeps PDC sizes / runtime
                # texture memory down.
                d = flatten_curves(d, samples=6)
                el.set("d", d)
        for attr in list(el.attrib):
            local = attr.rsplit("}", 1)[-1]
            if local in coord_attrs:
                el.set(attr, scale_attr_numbers(el.get(attr), factor))

    # Drop compound paths (paths whose `d` has more than one move-to).
    # svg2pdc parses them as one continuous polyline, drawing a stray
    # connector line between subpaths — that's the diagonal artefact on
    # the stop emoji's gray frame and a less-noticeable line under the
    # bottle's measurement marks. The compound paths in Twemoji are
    # decorative (gray border, ml-volume marks); dropping them yields
    # the cleanest look on a small low-res watch screen.
    SVG_NS = "{http://www.w3.org/2000/svg}"
    import re as _re
    MOVE_RE = _re.compile(r"[Mm]")
    for parent in list(root.iter()):
        for child in list(parent):
            tag = child.tag
            if tag != "path" and tag != f"{SVG_NS}path":
                continue
            if len(MOVE_RE.findall(child.get("d", ""))) > 1:
                parent.remove(child)

    # Add a thin black stroke to every path for a uniform outlined look.
    # Pebble's renderer draws stroke + fill in one pass via svg2pdc's path
    # command, so setting stroke=black, stroke-width=1 on the SVG is enough.
    for el in root.iter():
        tag = el.tag
        if tag == "path" or tag == f"{SVG_NS}path":
            if "stroke" not in el.attrib:
                el.set("stroke", "#000000")
            if "stroke-width" not in el.attrib:
                el.set("stroke-width", "2")

    # Convert <circle> elements to <path> 24-gons.
    # svg2pdc.py's path parser uses only the START point of each path
    # segment, so SVG arcs and beziers collapse to single points (no
    # curve sampling). To get a recognizably round shape, we explicitly
    # emit a 24-sided polygon approximating each circle. 24 sides is the
    # sweet spot — smooth enough to read as a circle on a 200-px screen,
    # cheap on the command-list byte budget.
    import math
    SVG_NS = "{http://www.w3.org/2000/svg}"
    SEGMENTS = 24
    for parent in list(root.iter()):
        for circle in list(parent):
            tag = circle.tag
            if tag != "circle" and tag != f"{SVG_NS}circle":
                continue
            cx = float(circle.get("cx", "0"))
            cy = float(circle.get("cy", "0"))
            r = float(circle.get("r", "0"))
            pts = []
            for i in range(SEGMENTS):
                theta = 2 * math.pi * i / SEGMENTS
                pts.append((cx + r * math.cos(theta), cy + r * math.sin(theta)))
            d = "M " + " L ".join(f"{x:g} {y:g}" for x, y in pts) + " Z"
            new_path = ET.SubElement(parent, f"{SVG_NS}path")
            new_path.set("d", d)
            for attr, value in circle.attrib.items():
                if attr.rsplit("}", 1)[-1] in {"cx", "cy", "r"}:
                    continue
                new_path.set(attr, value)
            parent.remove(circle)

    tree.write(dst_path, encoding="utf-8", xml_declaration=False)


if __name__ == "__main__":
    if len(sys.argv) not in (3, 4):
        print(__doc__)
        sys.exit(1)
    factor = float(sys.argv[3]) if len(sys.argv) == 4 else 2.0
    scale_svg(sys.argv[1], sys.argv[2], factor)
    print(f"Scaled {sys.argv[1]} → {sys.argv[2]} by {factor}x")
