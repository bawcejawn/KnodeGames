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


# ── the vhp-data format and its checks: the twin of vhp-data.js (read it for the format in words) ──
HOUR, DAY, DATA_VERSION = 1200, 28800, 1
_ADDR = re.compile(r"1[1-9A-HJ-NP-Za-km-z]{25,34}")
_ID = re.compile(r"0x[0-9a-f]{8,}")
_SAT = re.compile(r"(0|[1-9][0-9]{0,24})")


def canon(o):
    return json.dumps(o, separators=(",", ":"), ensure_ascii=False) + "\n"


def sha_hex(text):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _safe_int(x):
    return type(x) is int and -(2 ** 53 - 1) <= x <= 2 ** 53 - 1


def _check_shape(h):
    if not isinstance(h, dict) or h.get("v") != DATA_VERSION or type(h.get("v")) is not int:
        return "not a version-1 hour"
    keys = ["v", "n", "from", "to", "prev", "kind", "addrs", "sig", "ids", "burns", "events", "tail", "anchor"]
    if list(h.keys()) != keys:
        return "fields must be exactly " + ", ".join(keys)
    if not _safe_int(h["n"]) or h["n"] < 0 or h["from"] != h["n"] * HOUR or h["to"] != h["from"] + HOUR - 1 \
            or not _safe_int(h["from"]) or not _safe_int(h["to"]):
        return "from/to must be block-hour n"
    if type(h["prev"]) is not str or not re.fullmatch(r"([0-9a-f]{64})?", h["prev"]):
        return "prev must be a sha256"
    if h["kind"] not in ("live", "rebuilt"):
        return "kind must be live or rebuilt"
    addrs = h["addrs"]
    if not isinstance(addrs, list) or not all(type(a) is str and _ADDR.fullmatch(a) for a in addrs):
        return "bad address"
    if any(not addrs[i - 1] < addrs[i] for i in range(1, len(addrs))):
        return "addrs must be sorted and unique"
    aset = set(addrs)

    def blocks(b, n, where):
        if not isinstance(b, dict) or not all(isinstance(b.get(k), list) for k in ("sig", "ids", "burns", "events")):
            return where + ": sig, ids, burns, events"
        if len(b["sig"]) != n or len(b["ids"]) != n or len(b["burns"]) != n:
            return where + ": exactly one signer, one id and one burn per block"
        if not all(_safe_int(i) and 0 <= i < len(addrs) for i in b["sig"]):
            return where + ": bad signer index"
        if not all(type(x) is str and _ID.fullmatch(x) for x in b["ids"]):
            return where + ": bad block id"
        if not all(type(x) is str and _SAT.fullmatch(x) and x != "0" for x in b["burns"]):
            return where + ": every block burns VHP from its signer"
        return None
    e1 = blocks(h, HOUR, "hour")
    if e1:
        return e1
    a = h["anchor"]
    if not isinstance(a, dict) or list(a.keys()) != ["at", "id", "bal", "effA", "effB"]:
        return "anchor fields must be at, id, bal, effA, effB"
    if not _safe_int(a["at"]) or a["at"] < h["to"] or a["at"] > h["to"] + HOUR:
        return "the anchor must be read within an hour after the hour"
    if type(a["id"]) is not str or not _ID.fullmatch(a["id"]):
        return "bad anchor block id"
    t = h["tail"]
    if not isinstance(t, dict) or list(t.keys()) != ["sig", "ids", "burns", "events"]:
        return "tail fields must be sig, ids, burns, events"
    e2 = blocks(t, a["at"] - h["to"], "tail")
    if e2:
        return e2
    if (t["ids"][a["at"] - h["to"] - 1] if a["at"] > h["to"] else h["ids"][HOUR - 1]) != a["id"]:
        return "the anchor block id isn't the id of block `at`"
    for lo, hi, lst in ((h["from"], h["to"], h["events"]), (h["to"] + 1, a["at"], t["events"])):
        last = lo
        for e in lst:
            if not isinstance(e, list) or len(e) != 5:
                return "an event is [h, kind, from, to, value]"
            eh, k, f, to, v = e
            if not _safe_int(eh) or eh < lo or eh > hi or eh < last:
                return "events out of range or order"
            last = eh
            if k not in ("m", "t", "b") or type(v) is not str or not _SAT.fullmatch(v) or type(f) is not str or type(to) is not str:
                return "bad event"
            if (k == "m") != (f == "") or (k == "b") != (to == ""):
                return "bad event ends"
            if (f != "" and f not in aset) or (to != "" and to not in aset):
                return "an event names an address not in addrs"
    for m in ("bal", "effA", "effB"):
        if not isinstance(a[m], dict):
            return "anchor %s must be an object" % m
        ks = list(a[m].keys())
        if any(not ks[i - 1] < ks[i] for i in range(1, len(ks))):
            return "anchor %s keys must be sorted" % m
        if not all(k in aset and type(a[m][k]) is str and _SAT.fullmatch(a[m][k]) for k in ks):
            return "bad anchor %s" % m
    if h["kind"] == "rebuilt" and (a["effA"] or a["effB"]):
        return "a rebuilt hour has no effective-balance reads"
    return None


def deltas_of(h, with_tail=True):
    out = []

    def take(b, start):
        for i, v in enumerate(b["burns"]):
            out.append({"h": start + i, "a": h["addrs"][b["sig"][i]], "d": -int(v), "inc": 0})
        for eh, k, f, t, v in b["events"]:
            x = int(v)
            if k != "m":
                out.append({"h": eh, "a": f, "d": -x, "inc": 0})
            if k != "b":
                out.append({"h": eh, "a": t, "d": x, "inc": x})
    take(h, h["from"])
    if with_tail:
        take(h["tail"], h["to"] + 1)
    return out


def _fail(why):
    return {"ok": False, "why": why}


def check_hour(prev_text, text):
    """Same answers as checkHour in vhp-data.js."""
    try:
        h = json.loads(text)
    except Exception:
        return _fail("not JSON")
    try:
        if canon(h) != text:
            return _fail("not in canonical form")
    except Exception:
        return _fail("not in canonical form")
    bad = _check_shape(h)
    if bad:
        return _fail(bad)
    prev = None
    if prev_text:
        try:
            prev = json.loads(prev_text)
        except Exception:
            return _fail("previous file is not JSON")
        if h["prev"] != sha_hex(prev_text):
            return _fail("the hash chain is broken (prev isn't the previous file's sha256)")
        if h["n"] != prev["n"] + 1:
            return _fail("hours must be consecutive")
        if prev["kind"] == "live" and h["kind"] == "rebuilt":
            return _fail("a rebuilt hour can't follow a live one")
        t = prev["tail"]
        for i in range(len(t["sig"])):
            if prev["addrs"][t["sig"][i]] != h["addrs"][h["sig"][i]] or t["ids"][i] != h["ids"][i] or t["burns"][i] != h["burns"][i]:
                return _fail("block %d differs from the previous hour's tail" % (h["from"] + i))
        mine = "|".join(canon(e)[:-1] for e in h["events"] if e[0] <= prev["anchor"]["at"])
        if mine != "|".join(canon(e)[:-1] for e in t["events"]):
            return _fail("the events after the previous anchor differ from its tail")
    elif h["prev"] != "":
        return _fail("the first file must have an empty prev")
    bal = h["anchor"]["bal"]
    addrs = list(bal.keys())
    for s in [h["addrs"][i] for i in h["sig"]] + [h["addrs"][i] for i in h["tail"]["sig"]]:
        if s not in bal:
            return _fail("signer %s has no anchor" % s)
    ds = deltas_of(h)
    if prev is not None:
        for a in prev["anchor"]["bal"]:
            if a not in bal:
                return _fail("%s was anchored before and must stay anchored" % a)
        p0 = prev["anchor"]["at"]
        for a in addrs:
            if a not in prev["anchor"]["bal"]:
                continue
            v = int(prev["anchor"]["bal"][a]) + sum(x["d"] for x in ds if x["a"] == a and x["h"] > p0)
            if v != int(bal[a]):
                return _fail("%s: the previous anchor plus the hour's changes isn't this anchor (%d vs %s)" % (a, v, bal[a]))
    for a in addrs:
        v = int(bal[a])
        for x in sorted((x for x in ds if x["a"] == a), key=lambda x: -x["h"]):
            v -= x["d"]
            if v < 0:
                return _fail("%s: the rebuild goes below zero (a missed event)" % a)
    hsh = sha_hex(text)
    if h["kind"] == "rebuilt":
        return {"ok": True, "quality": "ok", "flagged": [], "hash": hsh}
    at = h["anchor"]["at"]

    def eff_of(a, H):
        b, recv = int(bal[a]), 0
        for x in ds:
            if x["a"] == a:
                if x["h"] >= H:
                    b -= x["d"]
                elif x["h"] >= H - 20 + 1:
                    recv += x["inc"]
        e = b - recv
        return e if e > 0 else 0
    missed, nxt, head = [], True, True
    for a in addrs:
        ea, eb = h["anchor"]["effA"].get(a), h["anchor"]["effB"].get(a)
        if ea is None or eb is None or ea != eb:
            missed.append(a)
            continue
        v = int(ea)
        if v != eff_of(a, at + 1):
            nxt = False
        if v != eff_of(a, at):
            head = False
    eff_at = "next" if nxt else "head" if head else ""
    if missed or not eff_at:
        return {"ok": True, "quality": "flagged", "flagged": ["*"], "hash": hsh,
                "why": ("effective balance missing or different on the two nodes: " + ", ".join(missed)) if missed
                else "the effective balances match the rebuild at neither the next block nor the read block"}
    return {"ok": True, "quality": "ok", "flagged": [], "effAt": eff_at, "hash": hsh}


def check_day(text, prev_hour_text):
    try:
        d = json.loads(text)
    except Exception:
        return _fail("not JSON")
    if not isinstance(d, dict) or canon(d) != text:
        return _fail("not in canonical form")
    if list(d.keys()) != ["v", "n", "from", "to", "hashes", "hours"] or d["v"] != DATA_VERSION:
        return _fail("fields must be v, n, from, to, hashes, hours")
    if not _safe_int(d["n"]) or d["from"] != d["n"] * DAY or d["to"] != d["from"] + DAY - 1:
        return _fail("from/to must be day n")
    if not isinstance(d["hours"], list) or len(d["hours"]) != 24 or not isinstance(d["hashes"], list) or len(d["hashes"]) != 24:
        return _fail("a day holds 24 hours")
    prev, flagged = prev_hour_text or "", []
    for i in range(24):
        hr = d["hours"][i]
        if not isinstance(hr, dict) or hr.get("n") != d["n"] * 24 + i:
            return _fail("hour %d is not block-hour %d" % (i, d["n"] * 24 + i))
        t = canon(hr)
        if sha_hex(t) != d["hashes"][i]:
            return _fail("hour %d: its sha256 isn't the one listed" % i)
        r = check_hour(prev, t)
        if not r["ok"]:
            return _fail("hour %d: %s" % (i, r["why"]))
        if r["quality"] == "flagged":
            flagged.append({"n": hr["n"], "flagged": r["flagged"]})
        prev = t
    return {"ok": True, "flagged": flagged, "last": prev}


def timeline_from(hours, checks=None):
    if not hours:
        raise ValueError("no hours")
    signers, ids, deltas, bad, rebuilt = [], [], [], [], []
    for i, h in enumerate(hours):
        if i and h["n"] != hours[i - 1]["n"] + 1:
            raise ValueError("hours %d and %d aren't consecutive" % (hours[i - 1]["n"], h["n"]))
        signers.extend(h["addrs"][s] for s in h["sig"])
        ids.extend(h["ids"])
        deltas.extend(deltas_of(h, i == len(hours) - 1))
        if h["kind"] == "rebuilt":
            rebuilt.append({"h0": h["from"], "h1": h["to"]})
        c = checks[i] if checks else None
        if c and c["quality"] == "flagged":
            if "*" in c["flagged"]:
                bad.append({"h0": h["from"], "h1": h["to"]})
            else:
                bad.extend({"h0": h["from"], "h1": h["to"], "a": a} for a in c["flagged"])
    last = hours[-1]
    anchors = {a: {"h": last["anchor"]["at"], "v": int(v)} for a, v in last["anchor"]["bal"].items()}
    return {"from": hours[0]["from"], "to": last["to"], "signers": signers, "ids": ids, "deltas": deltas,
            "anchors": anchors, "bad": bad, "rebuilt": rebuilt}
