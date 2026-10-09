"""Read-only story content bundled with the plugin."""
import json
import os
import re

TOKEN = re.compile(r"\{([a-z_]+)(?::([A-Za-z0-9_\-]+))?\}")
SUPPORTED = {"teams", "total_solves", "region_solves", "top_team", "first_blood",
             "incursion_hours_left"}
TARGETED = {"region_solves", "first_blood"}


def find_content_dir():
    env = os.environ.get("DOOM_CONTENT_DIR")
    here = os.path.dirname(os.path.abspath(__file__))
    for p in (env, os.path.join(here, "content"), os.path.join(here, "..", "..", "content")):
        if p and os.path.isfile(os.path.join(p, "regions.json")):
            return os.path.abspath(p)
    raise RuntimeError("ctfd-doom: content directory not found (set DOOM_CONTENT_DIR)")


def _json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def parse_frontmatter(text):
    if not text.startswith("---"):
        return {}, text
    _, fm, body = text.split("---", 2)
    meta = {}
    for line in fm.strip().splitlines():
        if ":" in line:
            k, v = line.split(":", 1)
            v = v.strip()
            meta[k.strip()] = None if v in ("", "null", "~") else v
    return meta, body.strip()


class Content:
    def __init__(self, root=None):
        self.root = root or find_content_dir()
        self.names = _json(os.path.join(self.root, "names.json"))
        reg = _json(os.path.join(self.root, "regions.json"))
        self.regions = reg["regions"]
        self.tiers = reg["tiers"]
        self.phases = _json(os.path.join(self.root, "phases.json"))
        self.broadcast_cfg = _json(os.path.join(self.root, "broadcasts.json"))
        self.messages = _json(os.path.join(self.root, "messages.json"))["messages"]
        self.dialogue = []
        ddir = os.path.join(self.root, "dialogue")
        for f in sorted(os.listdir(ddir)):
            if f.endswith(".json"):
                self.dialogue += _json(os.path.join(ddir, f))["dialogue"]
        self.challenges, self.bonus = [], []
        cdir = os.path.join(self.root, "challenges")
        for f in sorted(os.listdir(cdir)):
            d = _json(os.path.join(cdir, f))
            if "bonus" in d:
                self.bonus += d["bonus"]
                continue
            for c in d["challenges"]:
                c = dict(c, region=d["region"], category=d["category"])
                self.challenges.append(c)
        self.codex = {}
        xdir = os.path.join(self.root, "codex")
        for f in sorted(os.listdir(xdir)):
            if f.endswith(".md"):
                with open(os.path.join(xdir, f), encoding="utf-8") as fh:
                    meta, body = parse_frontmatter(fh.read())
                meta["text"] = body
                self.codex[meta["challenge"]] = meta
        self.by_name = {c["name"]: c for c in self.challenges}
        self.by_name.update({b["name"]: b for b in self.bonus})
        self.by_key = {c["key"]: c for c in self.challenges}
        self.by_key.update({b["key"]: b for b in self.bonus})
        self.category_region = {r["category"]: r["id"] for r in self.regions}
        self.region_ids = [r["id"] for r in self.regions]

    def region_for_category(self, category):
        return self.category_region.get(category)

    def broadcast(self, key):
        for b in self.broadcast_cfg["broadcasts"]:
            if b["key"] == key:
                return b
        return None


def render(text, stats):
    """Fill placeholders from live stats. Unknown tokens render as a dash."""
    def sub(m):
        name, arg = m.group(1), m.group(2)
        if name == "teams":
            return str(stats.get("teams", 0))
        if name == "total_solves":
            return str(stats.get("total_solves", 0))
        if name == "top_team":
            return stats.get("top_team") or "no one yet"
        if name == "incursion_hours_left":
            v = stats.get("incursion_hours_left", 0)
            return ("%.1f" % v).rstrip("0").rstrip(".") if v % 1 else str(int(v))
        if name == "region_solves":
            return str(stats.get("region_solves", {}).get(arg, 0))
        if name == "first_blood":
            return stats.get("first_blood", {}).get(arg) or "no one yet"
        return "-"
    return TOKEN.sub(sub, text)


def pick_variant(broadcast, stats, high_if=2.0):
    teams = max(1, stats.get("teams", 0))
    spt = stats.get("total_solves", 0) / teams
    v = broadcast["variants"]
    if spt >= high_if:
        return v["high"]
    if spt >= 1:
        return v["mid"]
    return v["low"]


def render_broadcast(broadcast, stats, high_if=2.0):
    return (render(pick_variant(broadcast, stats, high_if), stats),
            render(broadcast["subtitle"], stats))
