"""Handler messages are earned from CTFd solves; nothing is stored but read flags."""
ACT_ORDER = {"PRE": 0, "I": 1, "II": 2, "IV": 3, "END": 4}


def earned(messages, solved_keys, region_totals, region_released, act):
    """Return the messages a team has earned.

    solved_keys: set of challenge keys the team solved.
    region_totals: {region: [keys released in that region]}.
    """
    n_solved = len(solved_keys)
    cleared = False
    for region, keys in region_totals.items():
        if len(keys) >= 2 and all(k in solved_keys for k in keys):
            cleared = True
    out = []
    for m in messages:
        req = m.get("requires_challenge")
        if req and req not in solved_keys:
            continue
        t = m["trigger"]
        kind = t["type"]
        ok = False
        if kind == "first_solve":
            ok = n_solved >= 1
        elif kind == "solves":
            ok = n_solved >= t["n"]
        elif kind == "region_cleared":
            ok = cleared
        elif kind == "act":
            ok = ACT_ORDER.get(act, 0) >= ACT_ORDER[t["act"]]
        elif kind == "challenge":
            ok = t["challenge"] in solved_keys
        if ok:
            out.append(m)
    return out
