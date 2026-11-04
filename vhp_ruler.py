"""Knode Games — the shared VHP ruler, Python twin of vhp-ruler.js (design .ai/standards/VHP_RULER.md v2, D-111, D-112).

The publish job runs no repo code (RECORDER_STANDARD §6), so it carries a copy of this file inside the workflow; a test
keeps the two byte-identical, and another test checks that this file and vhp-ruler.js make byte-identical cards (§8
sim 11). Pure: standard library only, integers only (no float anywhere). Read vhp-ruler.js for the rules in words.
"""
import array, bisect, hashlib, json, re

VHP_CONTRACT = "12Y5vW6gk8GceH53YfRkRre2Rrcsgw7Naq"
DELAY, ACTIVE, HIGH, AVG, FORM, HISTORY, SEED_AFTER = 20, 7200, 1200, 28800, 403200, 28800, 20
M = 1000000
MIN_K, FORM_GATE = 10 * M, 800000
RULE_VERSION, OWN_RULES = 2, ("spot", "high1h", "avg24h")


def _int(x):
    if type(x) is bool:
        raise ValueError("not an integer")
    if type(x) is int:
        return x
    if type(x) is str and re.fullmatch(r"-?[0-9]+", x):
        return int(x)
    raise ValueError("not an integer: %r" % (x,))


def card_time(seed_block_id, game, rnd, W0, W1):
    if type(W0) is not int or type(W1) is not int or W1 < W0:
        raise ValueError("bad card window")
    if type(seed_block_id) is not str or not re.fullmatch(r"0x[0-9a-f]+", seed_block_id):
        raise ValueError("seed block id must be lowercase 0x-hex")
    d = hashlib.sha256(("%s|%d|%d" % (seed_block_id, _int(game), _int(rnd))).encode("utf-8")).digest()
    return W0 + int.from_bytes(d[:8], "big") % (W1 - W0 + 1)


def isqrt(n):
    if n < 0:
        raise ValueError("isqrt of a negative number")
    if n < 2:
        return n
    x = 1 << ((n.bit_length() + 1) >> 1)
    while True:
        y = (x + n // x) >> 1
        if y >= x:
            return x
        x = y


def trim(k, c):
    k, c = _int(k), _int(c)
    if k <= 0:
        raise ValueError("trim needs k > 0")
    if c < 0:
        raise ValueError("trim needs c >= 0")
    return isqrt(c * c * M // k)


def credit_of(own, eff_b):
    return M if eff_b <= own else own * M // eff_b


def k_of(blocks, own, total):
    return blocks * own * M // total if total > 0 else 0


def vhp_deltas(events, contract=VHP_CONTRACT):
    out = []
    for e in events if isinstance(events, list) else []:
        if not isinstance(e, dict) or e.get("src") != contract or type(e.get("h")) is not int:
            continue
        n = str(e.get("name") or "")
        if not re.fullmatch(r"(token\.)?(transfer|mint|burn)_event", n):
            continue
        if not re.fullmatch(r"[0-9]+", str(e.get("value"))):
            raise ValueError("bad VHP event value at block %d" % e["h"])
        v = int(e["value"])
        if n.endswith("transfer_event"):
            out.append({"h": e["h"], "a": e["from"], "d": -v, "inc": 0})
            out.append({"h": e["h"], "a": e["to"], "d": v, "inc": v})
        elif n.endswith("mint_event"):
            out.append({"h": e["h"], "a": e["to"], "d": v, "inc": v})
        else:
            out.append({"h": e["h"], "a": e["from"], "d": -v, "inc": 0})
    return out


class Ledger:
    """Same contract as ledger() in vhp-ruler.js."""

    def __init__(self, tl):
        frm, to = tl["from"], tl["to"]
        n = to - frm + 1
        if type(frm) is not int or type(to) is not int or n < ACTIVE + DELAY:
            raise ValueError("the timeline is too short")
        if len(tl["signers"]) != n:
            raise ValueError("one signer per block is required")
        self.frm, self.to, self.valid_from = frm, to, frm + ACTIVE
        self.ids = tl.get("ids")
        self.bad = tl.get("bad") or []
        self.rebuilt = tl.get("rebuilt") or []
        addrs, ix = [], {}

        def add(a):
            if a not in ix:
                ix[a] = len(addrs)
                addrs.append(a)
            return ix[a]
        sig = [add(a) for a in tl["signers"]]
        anchors = tl.get("anchors") or {}
        for a in sorted(anchors):
            add(a)
        for a in addrs:
            if a not in anchors:
                raise ValueError("no anchor for %s" % a)
        per = [dict() for _ in addrs]
        allx = [[] for _ in addrs]
        for x in tl.get("deltas") or []:
            i = ix.get(x["a"])
            if i is None:
                continue
            allx[i].append(x)
            if x["h"] < frm or x["h"] > to:
                continue
            g = per[i].setdefault(x["h"], [0, 0])
            g[0] += _int(x["d"])
            g[1] += _int(x.get("inc", 0))
        self.addrs, self.ix, self.sig = addrs, ix, sig
        lo, hi = frm + DELAY, to + 1
        self.cp, self.ev, self.ps, self.bal = [], [], [], []
        for i, a in enumerate(addrs):
            an = anchors[a]
            ah, av = an["h"], _int(an["v"])
            if type(ah) is not int or ah < frm - 1:
                raise ValueError("anchor for %s is before the timeline" % a)
            b0 = av
            for x in allx[i]:
                if frm <= x["h"] <= ah:
                    b0 -= _int(x["d"])
            hs = sorted(per[i])
            net, inc = [0], [0]
            for h in hs:
                net.append(net[-1] + per[i][h][0])
                inc.append(inc[-1] + per[i][h][1])

            def bal_before(H, hs=hs, net=net, b0=b0):
                return b0 + net[bisect.bisect_right(hs, H - 1)]

            def eff_at(H, hs=hs, inc=inc, bal_before=bal_before, a=a):
                b = bal_before(H)
                if b < 0:
                    raise ValueError("the VHP rebuild for %s went below zero at block %d (a missed event)" % (a, H))
                e = b - (inc[bisect.bisect_right(hs, H - 1)] - inc[bisect.bisect_right(hs, H - DELAY)])
                return e if e > 0 else 0
            pts = {lo}
            for h in hs:
                if lo < h + 1 <= hi:
                    pts.add(h + 1)
                if per[i][h][1] > 0 and lo < h + DELAY <= hi:
                    pts.add(h + DELAY)
            cp = sorted(pts)
            ev = [eff_at(H) for H in cp]
            ps = [0]
            for j in range(len(cp)):
                ps.append(ps[j] + ev[j] * ((cp[j + 1] if j + 1 < len(cp) else hi + 1) - cp[j]))
            self.cp.append(cp)
            self.ev.append(ev)
            self.ps.append(ps)
            self.bal.append(bal_before)
        self.signed_at = [[] for _ in addrs]
        for k in range(n):
            self.signed_at[sig[k]].append(frm + k)
        vf = self.valid_from
        cnt = [0] * len(addrs)
        cur = [self._eff(i, vf) for i in range(len(addrs))]
        for h in range(frm, vf):
            cnt[sig[h - frm]] += 1
        N = sum(cur[i] for i in range(len(addrs)) if cnt[i] > 0)
        changes = {}
        for i in range(len(addrs)):
            for j, H in enumerate(self.cp[i]):
                if H > vf:
                    changes.setdefault(H, []).append((i, self.ev[i][j]))
        Nb = [N]
        for H in range(vf + 1, to + 2):
            for i, v in changes.get(H, ()):
                if cnt[i] > 0:
                    N += v - cur[i]
                cur[i] = v
            s, r = sig[H - 1 - frm], sig[H - 1 - ACTIVE - frm]
            if cnt[s] == 0:
                N += cur[s]
            cnt[s] += 1
            cnt[r] -= 1
            if cnt[r] == 0:
                N -= cur[r]
            Nb.append(N)
        self.Nb = Nb
        self._shares = {}

    def _need(self, a):
        if a not in self.ix:
            raise ValueError("unknown address %s" % a)
        return self.ix[a]

    def _eff(self, i, H):
        if H < self.frm + DELAY or H > self.to + 1:
            raise ValueError("block %d is outside the data" % H)
        return self.ev[i][bisect.bisect_right(self.cp[i], H) - 1]

    def eff(self, a, H):
        return self._eff(self._need(a), H)

    def balance_before(self, a, H):
        return self.bal[self._need(a)](H)

    def sum_eff(self, a, H0, H1):
        if H1 < H0:
            return 0
        i = self._need(a)
        self._eff(i, H0)
        self._eff(i, H1)
        cp, ev, ps = self.cp[i], self.ev[i], self.ps[i]

        def S(x):
            j = bisect.bisect_right(cp, x - 1) - 1
            return 0 if j < 0 else ps[j] + ev[j] * (x - cp[j])
        return S(H1 + 1) - S(H0)

    def max_eff(self, a, H0, H1):
        i = self._need(a)
        m = self._eff(i, H0)
        cp, ev = self.cp[i], self.ev[i]
        j = bisect.bisect_right(cp, H0)
        while j < len(cp) and cp[j] <= H1:
            if ev[j] > m:
                m = ev[j]
            j += 1
        return m

    def N(self, H):
        if H < self.valid_from or H > self.to + 1:
            raise ValueError("no network total at block %d" % H)
        return self.Nb[H - self.valid_from]

    def signer(self, h):
        if h < self.frm or h > self.to:
            raise ValueError("block %d is outside the data" % h)
        return self.addrs[self.sig[h - self.frm]]

    def active(self, H):
        if H < self.valid_from or H > self.to + 1:
            raise ValueError("no active set at block %d" % H)
        return sorted({self.addrs[self.sig[h - self.frm]] for h in range(H - ACTIVE, H)})

    def signed_in(self, a, H0, H1):
        if H1 < H0:
            return 0
        l = self.signed_at[self._need(a)]
        return bisect.bisect_right(l, H1) - bisect.bisect_left(l, H0)

    def signed_blocks(self, a, H0, H1):
        l = self.signed_at[self._need(a)]
        return l[bisect.bisect_left(l, H0):bisect.bisect_right(l, H1)]

    def first_signed(self, a):
        l = self.signed_at[self._need(a)]
        return l[0] if l else None

    def share_sum(self, a, H0, H1):
        if H1 < H0:
            return 0
        if H0 < self.valid_from or H1 > self.to:
            raise ValueError("no shares for blocks %d … %d" % (H0, H1))
        i = self._need(a)
        s = self._shares.get(i)
        if s is None:
            vf, cp, ev, Nb = self.valid_from, self.cp[i], self.ev[i], self.Nb
            s = array.array("q", bytes(8 * (self.to - vf + 2)))  # prefix sums <= blocks x 10^6: inside 64 bits
            j = bisect.bisect_right(cp, vf) - 1
            acc = 0
            for H in range(vf, self.to + 1):
                while j + 1 < len(cp) and cp[j + 1] <= H:
                    j += 1
                Nh = Nb[H - vf]
                if Nh > 0:
                    acc += ev[j] * M // Nh
                s[H - vf + 1] = acc
            self._shares[i] = s
        return s[H1 - self.valid_from + 1] - s[H0 - self.valid_from]


def own(L, a, T, rule):
    if rule == "spot":
        return L.eff(a, T)
    if rule == "high1h":
        return L.max_eff(a, T - HIGH + 1, T)
    if rule == "avg24h":
        return avg(L, a, T)
    raise ValueError("unknown own rule %s" % rule)


def avg(L, a, T):
    return L.sum_eff(a, T - AVG, T - 1) // AVG


def total(L, T):
    return sum(avg(L, q, T) for q in L.active(T))


def form_of(L, a, T):
    H0, H1 = max(L.valid_from, T - FORM), T - 1
    expected, signed = L.share_sum(a, H0, H1), L.signed_in(a, H0, H1)
    return {"form": signed * M * M // expected if expected > 0 else 0, "signed": signed, "expected": expected, "from": H0}


def _bad_for(L, a, h0, h1):
    return any(r["h0"] <= h1 and r["h1"] >= h0 and (not r.get("a") or r.get("a") == a) for r in L.bad)


def _rebuilt_in(L, h0, h1):
    return any(r["h0"] <= h1 and r["h1"] >= h0 for r in L.rebuilt)


def _js(v):
    if type(v) is bool or v is None or type(v) is str:
        return v
    if type(v) is int:
        return v
    if isinstance(v, dict):
        return {k: _js(x) for k, x in v.items()}
    if isinstance(v, list):
        return [_js(x) for x in v]
    raise ValueError("not a card value: %r" % (v,))


# the card's fields that are BigInt in JavaScript (written as decimal strings)
_BIG_TOP, _BIG_ROW = ("c", "total"), ("own", "avg", "k", "form", "expected", "credited")


def card_json(card):
    c = dict(card)
    for k in _BIG_TOP:
        c[k] = str(_int(c[k]))
    rows = []
    for p in c["producers"]:
        p = dict(p)
        for k in _BIG_ROW:
            if k in p:
                p[k] = str(_int(p[k]))
        rows.append(p)
    c["producers"] = rows
    return json.dumps(_js(c), separators=(",", ":"), ensure_ascii=False) + "\n"


def _check_window(w):
    for k in ("W0", "W1", "S0", "S1", "L"):
        if type(w.get(k)) is not int:
            raise ValueError("window %s must be a block height" % k)
    if not (w["W0"] <= w["W1"] <= w["L"] <= w["S0"] <= w["S1"]):
        raise ValueError("window order must be W0 <= W1 <= L <= S0 <= S1")


def make_card(L, game, rnd, window, c, own_rule, paying, pooled=()):
    w = window
    _check_window(w)
    if own_rule not in OWN_RULES:
        raise ValueError("ownRule must be spot, high1h or avg24h")
    seed_block = w["L"] + SEED_AFTER
    if not L.ids:
        raise ValueError("the data has no block ids")
    seed_id = L.ids[seed_block - L.frm] if 0 <= seed_block - L.frm < len(L.ids) else None
    if type(seed_id) is not str:
        raise ValueError("no id for the seed block %d" % seed_block)
    T = card_time(seed_id, game, rnd, w["W0"], w["W1"])
    if T - AVG < L.frm + DELAY:
        raise ValueError("not enough history before the card time (24 h of data are needed)")
    pooled, c, paying = set(pooled), _int(c), bool(paying)
    blocks, tot = w["S1"] - w["S0"] + 1, total(L, T)
    rows = []
    for a in L.active(T):
        o, av, f = own(L, a, T, own_rule), avg(L, a, T), form_of(L, a, T)
        k = k_of(blocks, o, tot)
        first = L.first_signed(a)
        seen_at_start = first is not None and first < L.valid_from
        is_new = (not seen_at_start) and first is not None and T - first < FORM
        history = first is not None and (T - L.frm >= HISTORY if seen_at_start else T - first >= HISTORY)
        flagged = _bad_for(L, a, min(T - AVG, f["from"]), T) or (paying and _rebuilt_in(L, T - AVG, T))
        rows.append({"a": a, "own": o, "avg": av, "k": k, "form": f["form"],
                     "entry": k >= MIN_K and f["form"] >= FORM_GATE and history, "pooled": a in pooled,
                     "isNew": is_new, "quality": "flagged" if flagged else "ok"})
    rows.sort(key=lambda r: (-r["own"], r["a"]))
    return {"ruleVersion": RULE_VERSION, "game": _int(game), "round": str(rnd), "ownRule": own_rule, "paying": paying,
            "T": T, "seedBlock": seed_block, "seedBlockId": seed_id, "seedProducer": L.signer(seed_block),
            "window": {"W0": w["W0"], "W1": w["W1"], "L": w["L"], "S0": w["S0"], "S1": w["S1"]},
            "c": c, "total": tot, "producers": rows}


def score_card(L, card):
    S0, S1 = card["window"]["S0"], card["window"]["S1"]
    tot = _int(card["total"])
    rows = []
    for p in card["producers"]:
        o = _int(p["own"])
        credited = sum(credit_of(o, L.eff(p["a"], b)) for b in L.signed_blocks(p["a"], S0, S1))
        expected = _int(p["k"])
        if p["pooled"]:
            expected = 0
            H = S0
            while H <= S1:
                e = L.eff(p["a"], H)
                H2 = H
                while H2 + 1 <= S1 and L.eff(p["a"], H2 + 1) == e:
                    H2 += 1
                m = e if e < o else o
                expected += (H2 - H + 1) * (m * M // tot if tot > 0 else 0)
                H = H2 + 1
        flagged = p["quality"] == "flagged" or _bad_for(L, p["a"], S0, S1) or (card["paying"] and _rebuilt_in(L, S0, S1))
        q = dict(p)
        q.update({"quality": "flagged" if flagged else "ok", "expected": expected,
                  "signed": L.signed_in(p["a"], S0, S1), "credited": credited})
        rows.append(q)
    out = dict(card)
    out["producers"] = rows
    return out


def recompute(L, published):
    """published: the card's JSON text. Returns (same, diff)."""
    pub = json.loads(published)
    mine = make_card(L, pub["game"], pub["round"], pub["window"], pub["c"], pub["ownRule"], pub["paying"],
                     [p["a"] for p in pub.get("producers", []) if p.get("pooled")])
    if any("credited" in p for p in pub.get("producers", [])):
        mine = score_card(L, mine)
    a = card_json(mine)
    if a == published:
        return True, ""
    i = 0
    while i < min(len(a), len(published)) and a[i] == published[i]:
        i += 1
    return False, "differs at byte %d" % i
