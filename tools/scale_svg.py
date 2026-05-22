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
    """Multiply every number in a string by `factor`, leaving non-numeric
    characters (path commands, separators) untouched."""

    def repl(m: re.Match) -> str:
        n = float(m.group(0)) * factor
        # Compact representation: integer if whole, else trimmed decimal.
        if n == int(n):
            return str(int(n))
        # Avoid float artifacts like 18.000000000000004 — use 6 decimals.
        return f"{n:.6f}".rstrip("0").rstrip(".")

    return NUMBER_RE.sub(repl, value)


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
                el.set("d", scale_attr_numbers(d, factor))
        for attr in list(el.attrib):
            local = attr.rsplit("}", 1)[-1]
            if local in coord_attrs:
                el.set(attr, scale_attr_numbers(el.get(attr), factor))

    # Handle compound paths (paths whose `d` has more than one move-to).
    # svg2pdc parses them as one continuous polyline, drawing a stray
    # connector line between subpaths.
    #
    # Strategy depends on subpath size:
    #   * SMALL subpaths (each spans < 50% of the viewBox) → split into
    #     separate <path> elements so they render as independent shapes.
    #     Example: the bottle emoji's three measurement marks.
    #   * LARGE subpath (any spans ≥ 50%) → treat as a "frame with hole"
    #     where the outer subpath would cover earlier paths if drawn solid.
    #     Drop the whole compound path. Example: stop emoji's gray frame.
    SVG_NS = "{http://www.w3.org/2000/svg}"
    import re as _re
    MOVE_RE = _re.compile(r"[Mm]")
    NUM_RE = _re.compile(r"-?\d+\.?\d*(?:[eE][-+]?\d+)?")
    vb_parts = (root.get("viewBox") or "0 0 72 72").split()
    vb_w = float(vb_parts[2]) if len(vb_parts) >= 4 else 72.0

    def split_into_subpaths(d_str):
        """Parse the full d string, then re-serialize each Move-To group as
        a standalone absolute path. Returns a list of (sub_d, bbox_extent).

        We have to do it this way because subpaths often start with lowercase
        `m` (relative move) — pulling the substring out doesn't track the
        pen position, so the standalone subpath ends up positioned at the
        origin instead of where it actually renders."""
        import svg.path
        try:
            full = svg.path.parse_path(d_str)
        except Exception:
            return []
        # svg.path Move object marks a subpath boundary.
        groups = []
        cur = []
        for seg in full:
            if isinstance(seg, svg.path.Move):
                if cur:
                    groups.append(cur)
                cur = [seg]
            else:
                cur.append(seg)
        if cur:
            groups.append(cur)

        def fmt(c):
            return f"{c.real:g} {c.imag:g}"

        result = []
        for grp in groups:
            xs, ys = [], []
            for seg in grp:
                xs.append(seg.start.real); ys.append(seg.start.imag)
                xs.append(seg.end.real);   ys.append(seg.end.imag)
            ext = max(max(xs) - min(xs), max(ys) - min(ys)) if xs else 0
            # Manually re-serialize each segment with absolute coordinates.
            parts = []
            for seg in grp:
                name = seg.__class__.__name__
                if name == "Move":
                    parts.append(f"M {fmt(seg.end)}")
                elif name == "Line":
                    parts.append(f"L {fmt(seg.end)}")
                elif name == "CubicBezier":
                    parts.append(f"C {fmt(seg.control1)} {fmt(seg.control2)} {fmt(seg.end)}")
                elif name == "QuadraticBezier":
                    parts.append(f"Q {fmt(seg.control)} {fmt(seg.end)}")
                elif name == "Arc":
                    rot = getattr(seg, "rotation", 0)
                    large = 1 if seg.large_arc else 0
                    sweep = 1 if seg.sweep else 0
                    parts.append(f"A {seg.radius.real:g} {seg.radius.imag:g} {rot:g} {large} {sweep} {fmt(seg.end)}")
                elif name == "Close":
                    parts.append("Z")
            sub_d = " ".join(parts)
            result.append((sub_d, ext))
        return result

    for parent in list(root.iter()):
        for child in list(parent):
            tag = child.tag
            if tag != "path" and tag != f"{SVG_NS}path":
                continue
            d = child.get("d", "")
            if len(MOVE_RE.findall(d)) <= 1:
                continue
            subs = split_into_subpaths(d)
            if not subs:
                continue

            # Large subpath → drop the whole compound path.
            if any(ext > 0.5 * vb_w for _sd, ext in subs):
                parent.remove(child)
                continue

            # All small → split into separate path elements that inherit
            # the original attributes (fill, etc.).
            idx = list(parent).index(child)
            parent.remove(child)
            for offset, (sub_d, _ext) in enumerate(subs):
                new_path = ET.Element(f"{SVG_NS}path")
                for k, v in child.attrib.items():
                    if k.rsplit("}", 1)[-1] != "d":
                        new_path.set(k, v)
                new_path.set("d", sub_d)
                parent.insert(idx + offset, new_path)

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
