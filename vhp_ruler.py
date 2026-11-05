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
RULE_VERSION, OWN_RULES, POOL_RULES = 3, ("spot", "high1h", "avg24h"), ("min",)
STEADY_BAND = 150000   # D-120 as the owner ruled (5 Nov), millionths: steady = every daily rate within this of the 14-day rate
VOID_BAND = 100000     # owner, 5 Nov: a producer whose VHP leaves own × (1 ± this) during the race is void for that race
PCT_SCALE = 1 << 256


def _int(x):
    if type(x) is bool:
        raise ValueError("not an integer")
    if type(x) is int:
        return x
    if type(x) is str and re.fullmatch(r"-?[0-9]+", x):
        return int(x)
    raise ValueError("not an integer: %r" % (x,))


def _dec(x, what):
    """A game id or round as plain decimal text (no sign, spaces or hex), exactly as vhp-ruler.js's dec()."""
    if type(x) is int and 0 <= x <= 2 ** 53 - 1:
        return str(x)
    if type(x) is str and re.fullmatch(r"[0-9]{1,30}", x) and int(x) <= 2 ** 53 - 1:
        return str(int(x))
    raise ValueError("%s must be a whole number from 0 to 2^53 - 1" % what)


def card_time(seed_block_id, game, rnd, W0, W1):
    if type(W0) is not int or type(W1) is not int or W1 < W0:
        raise ValueError("bad card window")
    if type(seed_block_id) is not str or not re.fullmatch(r"0x[0-9a-f]+", seed_block_id):
        raise ValueError("seed block id must be lowercase 0x-hex")
    d = hashlib.sha256(("%s|%s|%s" % (seed_block_id, _dec(game, "game"), _dec(rnd, "round"))).encode("utf-8")).digest()
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


def pct(lam, x):
    """Fix A: the mid-p Poisson percentile in millionths, the same arithmetic as pct in vhp-ruler.js."""
    lam, x = _int(lam), _int(x)
    if lam < 0 or x < 0:
        raise ValueError("pct needs λ ≥ 0 and x ≥ 0")
    n, f = divmod(x, M)
    q, i, total, below, qn, qn1 = PCT_SCALE, 0, 0, 0, 0, 0
    while True:
        if i < n:
            below += q
        elif i == n:
            qn = q
        elif i == n + 1:
            qn1 = q
        total += q
        nx = q * lam // (M * (i + 1))
        i += 1
        if nx == 0 and i * M > lam and i > n + 1:
            break
        q = nx
    mid0, mid1 = 2 * below + qn, 2 * below + 2 * qn + qn1
    r = (mid0 * (M - f) + mid1 * f) * M // (2 * total * M)
    return M - 1 if lam > 0 and r >= M else r


def fpct(n, a, b, x):
    """A′: the field percentile, the same arithmetic as fpct in vhp-ruler.js."""
    n, a, b, x = _int(n), _int(a), _int(b), _int(x)
    if n < 0 or a < 0 or b < a or x < 0:
        raise ValueError("fpct needs n ≥ 0 and 0 ≤ a ≤ b, x ≥ 0")
    k, f = divmod(x, M)
    if k > n:
        return M  # x above every possible count: certain (Repo Lens #B-10 P1)

    def mid_at(j):
        if a == 0:
            return (2, 1) if j > 0 else (1, 1)
        if a == b or b == 0:
            return (0, 1) if j < n else (1, 1) if j == n else (2, 1)
        return None
    if mid_at(k):
        m0, t = mid_at(k)
        m1, _ = mid_at(k + 1)
        return (m0 * (M - f) + m1 * f) * M // (2 * t * M)
    q, total, below, qk, qk1 = PCT_SCALE, 0, 0, 0, 0
    i = 0
    while i <= n:
        if i < k:
            below += q
        elif i == k:
            qk = q
        elif i == k + 1:
            qk1 = q
        total += q
        q = q * (n - i) * a // ((i + 1) * (b - a))
        if q == 0 and i > k:
            break
        i += 1
    mid0, mid1 = 2 * below + qk, 2 * below + 2 * qk + qk1
    r = (mid0 * (M - f) + mid1 * f) * M // (2 * total * M)
    return M - 1 if r >= M else r


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
        self.pending = tl.get("pending") or []
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
            # prefix sums ~ blocks x 10^6 (a producer outside the active set can exceed 1 a block; still far inside 64 bits)
            s = array.array("q", bytes(8 * (self.to - vf + 2)))
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


def rate_of(L, a, T, f=None):
    """D-120: (rate, steady), as rateOf in vhp-ruler.js."""
    f = f or form_of(L, a, T)
    if T - FORM < L.valid_from or f["expected"] <= 0:
        return M, False
    for d in range(FORM // AVG):
        H0 = T - FORM + d * AVG
        e, s = L.share_sum(a, H0, H0 + AVG - 1), L.signed_in(a, H0, H0 + AVG - 1)
        dr = s * M * M // e if e > 0 else 0
        if abs(dr - f["form"]) > STEADY_BAND:
            return M, False
    return (f["form"] if f["form"] < M else M), True


def form_of(L, a, T):
    H0, H1 = max(L.valid_from, T - FORM), T - 1
    expected, signed = L.share_sum(a, H0, H1), L.signed_in(a, H0, H1)
    return {"form": signed * M * M // expected if expected > 0 else 0, "signed": signed, "expected": expected, "from": H0}


def _bad_for(L, a, h0, h1):
    return any(r["h0"] <= h1 and r["h1"] >= h0 and (not r.get("a") or r.get("a") == a) for r in L.bad)


def _rebuilt_in(L, h0, h1):
    return any(r["h0"] <= h1 and r["h1"] >= h0 for r in L.rebuilt)


def _pending_in(L, h0, h1):
    return any(r["h0"] <= h1 and r["h1"] >= h0 for r in L.pending)


EARLY = DELAY - 1   # a change up to 19 blocks before a window still moves effective VHP inside it (Repo Lens #B-5 N-7)


def _not_yet(L, h0, h1):
    r = sorted((x for x in L.pending if x["h0"] <= h1 and x["h1"] >= h0), key=lambda x: x["h0"])[0]
    return "not yet: unverified chained hours in the card's windows (from block %d); it is made once the next live hour checks them" % r["h0"]


def newcomer(L, a, T):
    """(isNew, history) of producer a at T, as newcomer in vhp-ruler.js (Repo Lens #B-5 N-6)."""
    lb0 = T - FORM - ACTIVE
    if lb0 >= L.frm:
        return L.signed_in(a, lb0, T - FORM - 1) == 0, L.signed_in(a, lb0, T - HISTORY) > 0
    first = L.first_signed(a)
    seen_at_start = first is not None and first < L.valid_from
    return ((not seen_at_start) and first is not None and T - first < FORM,
            first is not None and (T - L.frm >= HISTORY if seen_at_start else T - first >= HISTORY))


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
_BIG_TOP, _BIG_ROW = ("c", "total"), ("own", "avg", "k", "form", "rate", "expected", "credited", "pct", "fpct")


def card_json(card):
    c = dict(card)
    for k in _BIG_TOP:
        c[k] = str(_int(c[k]))
    rows = []
    for p in c["producers"]:
        p = dict(p)
        for k in _BIG_ROW:
            if k in p and p[k] is not None:
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


def make_card(L, game, rnd, window, c, own_rule, paying, pooled=(), min_k=10, pool_rule="min"):
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
    if type(min_k) is not int or not 1 <= min_k <= 100000:
        raise ValueError("minK must be a whole number of blocks from 1")
    if pool_rule not in POOL_RULES:
        raise ValueError("poolRule must be min")
    if paying and T - L.frm < FORM + ACTIVE:
        raise ValueError("a paying card needs %d blocks of data before its moment (14 days + 6 h)" % (FORM + ACTIVE))
    if paying and _pending_in(L, T - AVG - EARLY, T):
        raise ValueError(_not_yet(L, T - AVG - EARLY, T))
    form_from = max(L.valid_from, T - FORM)
    look0 = min(T - AVG, form_from)
    blocks, tot = w["S1"] - w["S0"] + 1, total(L, T)
    rows = []
    for a in L.active(T):
        o, av, f = own(L, a, T, own_rule), avg(L, a, T), form_of(L, a, T)
        k = k_of(blocks, o, tot)
        is_new, history = newcomer(L, a, T)
        rate, steady = rate_of(L, a, T, f)   # owner, 5 Nov: steady producers play at full size; rate is shown only
        rows.append({"a": a, "own": o, "avg": av, "k": k, "form": f["form"], "rate": rate,
                     "entry": k >= min_k * M and (steady or f["form"] >= FORM_GATE) and history, "pooled": a in pooled,
                     "isNew": is_new, "quality": "ok"})
    rows.sort(key=lambda r: (-r["own"], r["a"]))
    # D-113: on a paying card only the 24-h size window must be free of rebuilt hours; form's older days may read them
    if any(_bad_for(L, r["a"], look0 - EARLY, T) for r in rows) or (paying and _rebuilt_in(L, T - AVG - EARLY, T)):
        for r in rows:
            r["quality"] = "flagged"
    return {"ruleVersion": RULE_VERSION, "game": int(_dec(game, "game")), "round": _dec(rnd, "round"), "ownRule": own_rule, "paying": paying,
            "T": T, "seedBlock": seed_block, "seedBlockId": seed_id, "seedProducer": L.signer(seed_block),
            "window": {"W0": w["W0"], "W1": w["W1"], "L": w["L"], "S0": w["S0"], "S1": w["S1"]},
            "c": c, "minK": min_k, "poolRule": pool_rule, "total": tot, "formFrom": form_from, "producers": rows}


def score_card(L, card):
    S0, S1 = card["window"]["S0"], card["window"]["S1"]
    tot = _int(card["total"])
    if card["paying"] and _pending_in(L, S0 - EARLY, S1):
        raise ValueError(_not_yet(L, S0 - EARLY, S1))
    flagged = any(p["quality"] == "flagged" or _bad_for(L, p["a"], S0 - EARLY, S1) for p in card["producers"]) \
        or (card["paying"] and _rebuilt_in(L, S0 - EARLY, S1))
    rows = []
    for p in card["producers"]:
        o = _int(p["own"])
        credited = sum(credit_of(o, L.eff(p["a"], b)) for b in L.signed_blocks(p["a"], S0, S1))
        expected = _int(p["k"])
        lo, hi = o * (M - VOID_BAND) // M, o * (M + VOID_BAND) // M
        is_void = False
        H = S0
        while H <= S1:
            e = L.eff(p["a"], H)
            H2 = H
            while H2 + 1 <= S1 and L.eff(p["a"], H2 + 1) == e:
                H2 += 1
            if e < lo or e > hi:
                is_void = True
                break
            H = H2 + 1
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
        q = dict(p)
        q.update({"quality": "flagged" if flagged else "ok", "expected": expected,
                  "signed": L.signed_in(p["a"], S0, S1), "credited": credited, "pct": pct(expected, credited),
                  "void": is_void})
        rows.append(q)
    # A′: totals from the field's core (form ≥ FORM_GATE, Repo Lens #B-10 F1), each other core member at its expected
    # blocks × its rate and the producer itself at full size; a member below the gate is scored against the core plus
    # itself at full size, as scoreCard in vhp-ruler.js
    def in_field(r):
        return r["entry"] and not r["void"]

    def in_core(r):
        return in_field(r) and _int(r["form"]) >= FORM_GATE

    def at_rate(r):
        return r["expected"] * _int(r["rate"]) // M
    n = sum(r["signed"] for r in rows if in_core(r))
    bw = sum(at_rate(r) for r in rows if in_core(r))
    for r in rows:
        if not in_field(r):
            r["fpct"] = None
        elif in_core(r):
            r["fpct"] = fpct(n, r["expected"], bw - at_rate(r) + r["expected"], r["credited"])
        else:
            r["fpct"] = fpct(n + r["signed"], r["expected"], bw + r["expected"], r["credited"])
    out = dict(card)
    out["producers"] = rows
    return out


_SETTINGS, _WKEYS = ("game", "round", "window", "c", "minK", "poolRule", "ownRule", "paying", "pooled"), ("W0", "W1", "L", "S0", "S1")


def check_settings(g):
    """The game's settings, strictly (Repo Lens #B-5 N-5), as checkSettings in vhp-ruler.js."""
    if not isinstance(g, dict):
        raise ValueError("recompute needs the game's own settings")
    if sorted(g) != sorted(_SETTINGS):
        raise ValueError("the game's settings must have exactly: " + ", ".join(_SETTINGS))
    _dec(g["game"], "game")
    _dec(g["round"], "round")
    w = g["window"]
    if not isinstance(w, dict) or sorted(w) != sorted(_WKEYS):
        raise ValueError("window must have exactly: " + ", ".join(_WKEYS))
    c = g["c"]
    if not ((type(c) is int and 0 <= c <= 2 ** 53 - 1) or (type(c) is str and re.fullmatch(r"[0-9]{1,30}", c))):
        raise ValueError("c must be a whole number of millionths")
    if type(g["minK"]) is not int or not 1 <= g["minK"] <= 100000:
        raise ValueError("minK must be a whole number of blocks from 1")
    if g["poolRule"] not in POOL_RULES:
        raise ValueError("poolRule must be min")
    if g["ownRule"] not in OWN_RULES:
        raise ValueError("ownRule must be spot, high1h or avg24h")
    if type(g["paying"]) is not bool:
        raise ValueError("paying must be true or false")
    if not isinstance(g["pooled"], list) or not all(type(a) is str for a in g["pooled"]):
        raise ValueError("pooled must be a list of addresses")


def recompute(L, published, game):
    """published: the card's JSON text; game: the game's OWN settings {game, round, window, c, minK, poolRule, ownRule, paying, pooled}
    (Repo Lens #E-12 M-1: never the card's own settings). Returns (same, diff)."""
    try:
        check_settings(game)
    except ValueError as e:
        return False, "the game's settings: %s" % e
    pub = json.loads(published)
    w = game["window"]
    want = {"game": int(_dec(game["game"], "game")), "round": _dec(game["round"], "round"), "ownRule": game["ownRule"],
            "paying": game["paying"], "c": str(int(game["c"])), "minK": game["minK"], "poolRule": game["poolRule"],
            "W0": w["W0"], "W1": w["W1"], "L": w["L"], "S0": w["S0"], "S1": w["S1"]}
    got = {"game": pub.get("game"), "round": pub.get("round"), "ownRule": pub.get("ownRule"), "paying": pub.get("paying"),
           "c": str(pub.get("c")), "minK": pub.get("minK"), "poolRule": pub.get("poolRule")}
    got.update(pub.get("window") or {})
    for k in want:
        if got.get(k) != want[k] or type(got.get(k)) is not type(want[k]):
            return False, "setting %s: the card says %s, the game says %s" % (k, json.dumps(got.get(k)), json.dumps(want[k]))
    try:
        mine = make_card(L, game["game"], game["round"], w, int(game["c"]), game["ownRule"], game["paying"], game["pooled"],
                         game["minK"], game["poolRule"])
        if any("credited" in p for p in pub.get("producers", [])):
            mine = score_card(L, mine)
    except ValueError as e:
        return False, "the data can't make this card: %s" % e
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
_ID = re.compile(r"0x1220[0-9a-f]{64}")
_SAT = re.compile(r"(0|[1-9][0-9]{0,24})")


def canon(o):
    return json.dumps(o, separators=(",", ":"), ensure_ascii=False) + "\n"


def sha_hex(text):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _safe_int(x):
    return type(x) is int and -(2 ** 53 - 1) <= x <= 2 ** 53 - 1


def _sorted_keys(o):
    ks = list(o.keys())
    return all(ks[i - 1] < ks[i] for i in range(1, len(ks)))


def _check_shape(h):
    if not isinstance(h, dict) or type(h.get("v")) is not int or h.get("v") != DATA_VERSION:
        return "not a version-1 hour"
    keys = ["v", "n", "from", "to", "prev", "kind", "addrs", "sig", "ids", "burns", "events", "tail", "anchor"]
    if list(h.keys()) != keys:
        return "fields must be exactly " + ", ".join(keys)
    if not _safe_int(h["n"]) or h["n"] < 0 or not _safe_int(h["from"]) or not _safe_int(h["to"]) \
            or h["from"] != h["n"] * HOUR or h["to"] != h["from"] + HOUR - 1:
        return "from/to must be block-hour n"
    if type(h["prev"]) is not str or not re.fullmatch(r"([0-9a-f]{64})?", h["prev"]):
        return "prev must be a sha256"
    if h["kind"] not in ("live", "rebuilt", "chained"):
        return "kind must be live, rebuilt or chained"
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
    if not isinstance(a, dict) or list(a.keys()) != ["at", "id", "bal", "reads"]:
        return "anchor fields must be at, id, bal, reads"
    if not _safe_int(a["at"]) or a["at"] < h["to"] or a["at"] > h["to"] + DAY:
        return "the anchor block must be at most a day after the hour"
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
    if not isinstance(a["bal"], dict) or not _sorted_keys(a["bal"]):
        return "anchor bal must be an object with sorted keys"
    if not all(k in aset and type(v) is str and _SAT.fullmatch(v) for k, v in a["bal"].items()):
        return "bad anchor bal"
    if not isinstance(a["reads"], dict) or list(a["reads"].keys()) != ["A", "B"]:
        return "anchor reads must be A and B"
    for node in ("A", "B"):
        rs = a["reads"][node]
        if not isinstance(rs, dict) or not _sorted_keys(rs):
            return "reads %s must be an object with sorted keys" % node
        for k, r in rs.items():
            if k not in a["bal"]:
                return "reads %s: %s isn't anchored" % (node, k)
            if not isinstance(r, list) or len(r) != 3 or not _safe_int(r[0]) or r[0] < h["to"] or r[0] > a["at"]:
                return "reads %s: %s must be [h, balance, eff] read between the hour's end and the anchor block" % (node, k)
            if type(r[1]) is not str or not _SAT.fullmatch(r[1]) or type(r[2]) is not str or not (r[2] == "" or _SAT.fullmatch(r[2])):
                return "reads %s: bad numbers for %s" % (node, k)
    if h["kind"] != "live" and (a["reads"]["A"] or a["reads"]["B"]):
        return "a %s hour carries no reads" % h["kind"]
    if h["kind"] == "live":
        for node in ("A", "B"):
            for k in a["bal"]:
                if k not in a["reads"][node]:
                    return "a live hour reads every anchored address on both nodes (%s on %s)" % (k, node)
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


def _block_of(f, x):
    if f["from"] <= x <= f["to"]:
        i = x - f["from"]
        return "%s|%s|%s" % (f["addrs"][f["sig"][i]], f["ids"][i], f["burns"][i])
    if f["to"] < x <= f["anchor"]["at"]:
        i = x - f["to"] - 1
        t = f["tail"]
        return "%s|%s|%s" % (f["addrs"][t["sig"][i]], t["ids"][i], t["burns"][i])
    return None


def _events_in(f, x0, x1):
    return "|".join(canon(e)[:-1] for e in f["events"] + f["tail"]["events"] if x0 <= e[0] <= x1)


def _fail(why):
    return {"ok": False, "why": why}


def check_hour(prev_text, text):
    """Same answers as checkHour in vhp-data.js."""
    try:
        h = json.loads(text)
        if canon(h) != text:
            return _fail("not in canonical form")
    except Exception:
        return _fail("not JSON")
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
        if prev["kind"] != "rebuilt" and h["kind"] == "rebuilt":
            return _fail("a rebuilt hour can't follow a %s one" % prev["kind"])
        if h["anchor"]["at"] < prev["anchor"]["at"]:
            return _fail("anchors go forward")
        if h["kind"] == "chained" and h["anchor"]["at"] != max(h["to"], prev["anchor"]["at"]):
            return _fail("a chained hour's anchor is its own last block, or the previous anchor if that is later")
        for x in range(h["from"], prev["anchor"]["at"] + 1):
            if _block_of(prev, x) != _block_of(h, x):
                return _fail("block %d differs from the previous hour's tail" % x)
        if _events_in(prev, h["from"], prev["anchor"]["at"]) != _events_in(h, h["from"], prev["anchor"]["at"]):
            return _fail("the events after the previous hour differ from its tail")
    elif h["prev"] != "":
        return _fail("the first file must have an empty prev")
    elif h["kind"] == "chained":
        return _fail("a chained hour needs the hour before it")
    bal = h["anchor"]["bal"]
    addrs = list(bal.keys())
    for s in [h["addrs"][i] for i in h["sig"] + h["tail"]["sig"]]:
        if s not in bal:
            return _fail("signer %s has no anchor" % s)
    ds = deltas_of(h)
    by_a = {}
    for x in ds:
        by_a.setdefault(x["a"], []).append(x)

    def after(a, h0):
        return sum(x["d"] for x in by_a.get(a, ()) if x["h"] > h0)
    if prev is not None:
        for a in prev["anchor"]["bal"]:
            if a not in bal:
                return _fail("%s was anchored before and must stay anchored" % a)
        for a in addrs:
            if a not in prev["anchor"]["bal"]:
                continue
            v = int(prev["anchor"]["bal"][a]) + after(a, prev["anchor"]["at"])
            if v != int(bal[a]):
                return _fail("%s: the previous anchor plus the changes since isn't this anchor (%d vs %s)" % (a, v, bal[a]))
    for a in addrs:
        v = int(bal[a])
        for x in sorted(by_a.get(a, ()), key=lambda x: -x["h"]):
            v -= x["d"]
            if v < 0:
                return _fail("%s: the rebuild goes below zero (a missed event)" % a)
    hsh = sha_hex(text)
    if h["kind"] != "live":
        return {"ok": True, "quality": "ok", "flagged": [], "hash": hsh}
    reads = h["anchor"]["reads"]
    for node in ("A", "B"):
        for a in addrs:
            rh, rb, _ = reads[node][a]
            if int(rb) + after(a, rh) != int(bal[a]):
                return _fail("%s: node %s's balance read at block %d plus the changes since isn't the anchor" % (a, node, rh))

    def eff_of(a, H):
        b, recv = int(bal[a]), 0
        for x in by_a.get(a, ()):
            if x["h"] >= H:
                b -= x["d"]
            elif x["h"] >= H - DELAY + 1:
                recv += x["inc"]
        e = b - recv
        return e if e > 0 else 0
    missed, nxt, head = [], True, True
    for a in addrs:
        ra, rb = reads["A"][a], reads["B"][a]
        if ra[2] == "" or rb[2] == "":
            missed.append("%s (no answer)" % a)
            continue
        for r in (ra, rb):
            v = int(r[2])
            if v != eff_of(a, r[0] + 1):
                nxt = False
            if v != eff_of(a, r[0]):
                head = False
    eff_at = "next" if nxt else "head" if head else ""
    if missed or not eff_at:
        return {"ok": True, "quality": "flagged", "flagged": ["*"], "hash": hsh,
                "why": ("effective balance not answered: " + ", ".join(missed)) if missed
                else "the effective balances match the rebuild neither at the block after each read nor at each read block"}
    return {"ok": True, "quality": "ok", "flagged": [], "effAt": eff_at, "hash": hsh}


def check_day(text, prev_hour_text):
    try:
        d = json.loads(text)
        if not isinstance(d, dict) or canon(d) != text:
            return _fail("not in canonical form")
    except Exception:
        return _fail("not JSON")
    if list(d.keys()) != ["v", "n", "from", "to", "hashes", "hours"] or type(d["v"]) is not int or d["v"] != DATA_VERSION:
        return _fail("fields must be v, n, from, to, hashes, hours")
    if not _safe_int(d["n"]) or not _safe_int(d["from"]) or not _safe_int(d["to"]) or d["from"] != d["n"] * DAY or d["to"] != d["from"] + DAY - 1:
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
    signers, ids, deltas, bad, rebuilt, pending = [], [], [], [], [], []
    for i, h in enumerate(hours):
        if i and h["n"] != hours[i - 1]["n"] + 1:
            raise ValueError("hours %d and %d aren't consecutive" % (hours[i - 1]["n"], h["n"]))
        signers.extend(h["addrs"][s] for s in h["sig"])
        ids.extend(h["ids"])
        deltas.extend(deltas_of(h, i == len(hours) - 1))
        if h["kind"] == "rebuilt":
            rebuilt.append({"h0": h["from"], "h1": h["to"]})
        elif h["kind"] == "chained" and not any(x["kind"] == "live" for x in hours[i + 1:]):
            pending.append({"h0": h["from"], "h1": h["to"]})
        c = checks[i] if checks else None
        if c and c["quality"] == "flagged":
            if "*" in c["flagged"]:
                bad.append({"h0": h["from"], "h1": h["to"]})
            else:
                bad.extend({"h0": h["from"], "h1": h["to"], "a": a} for a in c["flagged"])
    last = hours[-1]
    anchors = {a: {"h": last["anchor"]["at"], "v": int(v)} for a, v in last["anchor"]["bal"].items()}
    return {"from": hours[0]["from"], "to": last["to"], "signers": signers, "ids": ids, "deltas": deltas,
            "anchors": anchors, "bad": bad, "rebuilt": rebuilt, "pending": pending}


# ── the publish job (.github/workflows/vhp-ruler.yml runs this whole file, then publish_main) ──
# canonical numbers only (Repo Lens #D-10 M-5): h/024010.json can't stand beside h/24010.json
_HOUR_FILE, _DAY_FILE = re.compile(r"h/(0|[1-9][0-9]{0,8})\.json"), re.compile(r"d/(0|[1-9][0-9]{0,8})\.json")
MAX_HOUR_BYTES, MAX_DAY_BYTES, MIN_KEEP_DAYS = 4 << 20, 16 << 20, 22


def _read_tree(d):
    """{relative path: text} for h/*.json and d/*.json under d (other files are an error, reported by the caller)."""
    import os
    out, other = {}, []
    if not d or not os.path.isdir(d):
        return out, other
    for root, dirs, files in os.walk(d):
        for f in files:
            p = os.path.relpath(os.path.join(root, f), d).replace(os.sep, "/")
            if p in ("remove.txt", "verify.txt"):
                continue
            if os.path.islink(os.path.join(root, f)) or not (_HOUR_FILE.fullmatch(p) or _DAY_FILE.fullmatch(p)):
                other.append(p)
                continue
            with open(os.path.join(root, f), "rb") as fh:
                raw = fh.read()
            try:
                out[p] = raw.decode("utf-8")
            except UnicodeDecodeError:
                other.append(p)
    return out, other


def _num_inside(text):
    try:
        n = json.loads(text).get("n")
        return n if _safe_int(n) else None
    except Exception:
        return None


def publish_check(incoming, published, removals, keep_days):
    """incoming / published: {path: text}; removals: paths the run asks to remove. Returns (errors, warnings)."""
    errs, warns = [], []
    keep_days = max(MIN_KEEP_DAYS, keep_days)
    hours = {int(_HOUR_FILE.fullmatch(p).group(1)): t for p, t in published.items() if _HOUR_FILE.fullmatch(p)}
    days = {int(_DAY_FILE.fullmatch(p).group(1)): t for p, t in published.items() if _DAY_FILE.fullmatch(p)}
    new_h = {int(_HOUR_FILE.fullmatch(p).group(1)): t for p, t in incoming.items() if _HOUR_FILE.fullmatch(p)}
    new_d = {int(_DAY_FILE.fullmatch(p).group(1)): t for p, t in incoming.items() if _DAY_FILE.fullmatch(p)}
    empty = not hours and not days
    for n, t in list(new_h.items()):
        if _num_inside(t) != n:
            errs.append("h/%d.json holds another hour's number" % n)   # #D-10 L-12
        if len(t.encode("utf-8")) > MAX_HOUR_BYTES:
            errs.append("h/%d.json is over %d bytes" % (n, MAX_HOUR_BYTES))
        if n in hours:
            if hours[n] != t:
                errs.append("h/%d.json is already published and can't be rewritten" % n)
            del new_h[n]
    for n, t in list(new_d.items()):
        if _num_inside(t) != n:
            errs.append("d/%d.json holds another day's number" % n)
        if len(t.encode("utf-8")) > MAX_DAY_BYTES:
            errs.append("d/%d.json is over %d bytes" % (n, MAX_DAY_BYTES))
        if n in days:
            if days[n] != t:
                errs.append("d/%d.json is already published and can't be rewritten" % n)
            del new_d[n]

    def hour_text(n):
        for src in (hours, new_h):
            if n in src:
                return src[n]
        for src in (days, new_d):
            if n // 24 in src:
                try:
                    return canon(json.loads(src[n // 24])["hours"][n % 24])
                except Exception:
                    return None
        return None
    known = set(hours) | {d * 24 + i for d in days for i in range(24)}
    newest = max(known) if known else None
    # new hours: consecutive, after the newest published one, each checked against the one before
    if new_h:
        ns = sorted(new_h)
        if ns != list(range(ns[0], ns[0] + len(ns))):
            errs.append("new hours must be consecutive")
        elif newest is not None and ns[0] != newest + 1:
            errs.append("the first new hour must be h/%d.json" % (newest + 1))
        else:
            prev = hour_text(ns[0] - 1) if newest is not None else ""
            if prev is None:
                errs.append("the hour before h/%d.json isn't published" % ns[0])
            elif not empty and prev == "":
                errs.append("only the very first publish may start a chain")
            else:
                for n in ns:
                    r = check_hour(prev, new_h[n])
                    if not r["ok"]:
                        errs.append("h/%d.json: %s" % (n, r["why"]))
                        break
                    if r["quality"] == "flagged":
                        warns.append("h/%d.json is flagged: %s" % (n, r.get("why", "")))
                    prev = new_h[n]
    # new days (#D-10 M-6): only roll up hours that already exist (published or new h/ files), byte for byte; the
    # chain is checked from the hour before
    for d in sorted(new_d):
        try:
            hrs = json.loads(new_d[d])["hours"]
            texts = [canon(h) for h in hrs]
        except Exception:
            errs.append("d/%d.json is not a day file" % d)
            continue
        missing = [d * 24 + i for i in range(len(texts)) if (hours.get(d * 24 + i) or new_h.get(d * 24 + i)) != texts[i]]
        if len(texts) != 24 or missing:
            errs.append("d/%d.json: its hours must be published (or new) hour files, byte for byte (hour %s)" % (d, missing[0] if missing else "count"))
            continue
        first_prev = json.loads(texts[0]).get("prev")
        prev = hour_text(d * 24 - 1)
        if prev is None:
            if first_prev != "" or d * 24 != min(known | set(new_h)):   # only the day that starts the chain
                errs.append("d/%d.json: the hour before it isn't available" % d)
                continue
            prev = ""
        r = check_day(new_d[d], prev)
        if not r["ok"]:
            errs.append("d/%d.json: %s" % (d, r["why"]))
    # removals: an hour only once a day file holds it (same sha256); days only beyond retention, oldest first, with
    # no hole (#D-10 M-6); newest day from the hour files themselves
    all_days = dict(days)
    all_days.update(new_d)
    hour_ns = set(hours) | set(new_h)
    newest_day = (max(hour_ns) // 24) if hour_ns else (max(all_days) if all_days else 0)
    day_rm = []
    for p in removals:
        m_h, m_d = _HOUR_FILE.fullmatch(p), _DAY_FILE.fullmatch(p)
        if m_h:
            n = int(m_h.group(1))
            if n not in hours:
                errs.append("remove %s: not published" % p)
            elif n // 24 not in all_days or json.loads(all_days[n // 24])["hashes"][n % 24] != sha_hex(hours[n]):
                errs.append("remove %s: no day file holds it" % p)
        elif m_d:
            n = int(m_d.group(1))
            if n not in days:
                errs.append("remove %s: not published" % p)
            elif n >= newest_day - keep_days:
                errs.append("remove %s: still inside the %d days kept" % (p, keep_days))
            day_rm.append(n)
        else:
            errs.append("remove %s: not a vhp-data file" % p)
    if day_rm and sorted(day_rm) != sorted(days)[:len(day_rm)]:
        errs.append("days are removed oldest first, with no hole")
    return errs, warns


def _rpc(url, method, params, timeout=60):
    import urllib.request
    body = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers={"content-type": "application/json", "user-agent": "knode-vhp-ruler-publish"})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                out = json.loads(r.read().decode("utf-8"))
            if "error" in out:
                raise ValueError(str(out["error"])[:200])
            return out["result"]
        except Exception:
            if attempt == 3:
                raise
            import time
            time.sleep(2 * (attempt + 1))


def verify_blocks(new_hours, url):
    """Repo Lens #D-10 M-1: the record job's files prove consistency, not truth. Every new block's id and signer (and
    each anchor block's id) must also be what a node says when this job, with no repository code, asks it itself.
    Returns a list of errors."""
    want = {}
    for t in new_hours:
        h = json.loads(t)
        for part, start in ((h, h["from"]), (h["tail"], h["to"] + 1)):
            for i, idx in enumerate(part["sig"]):
                want[start + i] = (part["ids"][i], h["addrs"][idx])
    if not want:
        return []
    head = _rpc(url, "chain.get_head_info", {})
    head_id, lib = head["head_topology"]["id"], int(head.get("last_irreversible_block", 0))
    hs = sorted(want)
    if hs[-1] > lib:
        return ["block %d isn't irreversible on the checking node yet (it is at %d); tried again next run" % (hs[-1], lib)]
    from concurrent.futures import ThreadPoolExecutor
    runs, k = [], 0
    while k < len(hs):
        s, e = hs[k], hs[k]
        while k + 1 < len(hs) and hs[k + 1] == e + 1 and e - s < 99:
            k += 1
            e = hs[k]
        runs.append((s, e))
        k += 1

    def fetch(r):
        s, e = r
        res = _rpc(url, "block_store.get_blocks_by_height", {"head_block_id": head_id, "ancestor_start_height": str(s),
                   "num_blocks": e - s + 1, "return_block": True, "return_receipt": False})
        return [(int(it["block_height"]), str(it["block_id"]), str(it["block"]["header"]["signer"])) for it in res.get("block_items", [])]
    errs, got = [], {}
    ex = ThreadPoolExecutor(max_workers=4)
    try:
        for items in ex.map(fetch, runs):   # results in order; the first failure raises here
            for hh, bid, sg in items:
                got[hh] = (bid, sg)
    finally:
        # Repo Lens #B-5 N-9: on a failure, drop the batches still queued instead of waiting for all of them
        ex.shutdown(wait=True, cancel_futures=True)
    for hh in hs:
        if hh not in got:
            errs.append("the checking node didn't return block %d" % hh)
        elif got[hh] != want[hh]:
            errs.append("block %d: the checking node says id %s signer %s, the file says id %s signer %s" % (hh, got[hh][0], got[hh][1], want[hh][0], want[hh][1]))
        if len(errs) >= 5:
            break
    return errs


def publish_main(argv):
    """argv: incoming dir, published dir, keep days. Env RPC_VERIFY (a third node, optional) or RPC_CHECK: every new
    block is read again there by this job. Exit 0 = publish, 1 = refuse."""
    import os
    inc_dir, pub_dir, keep = argv[0], argv[1], int(argv[2])
    incoming, other = _read_tree(inc_dir)
    published, _ = _read_tree(pub_dir)
    removals = []
    rf = os.path.join(inc_dir, "remove.txt")
    if os.path.exists(rf):
        with open(rf, encoding="utf-8") as fh:
            removals = [x for x in fh.read().split("\n") if x]
    errs, warns = publish_check(incoming, published, removals, keep)
    for p in other:
        errs.append("unexpected file %s" % p)
    new_hours = [t for p, t in sorted(incoming.items()) if p.startswith("h/") and p not in published]
    if not errs and new_hours:
        # #D-10 M-1: the record job runs repository code and npm packages; this job runs neither, and reads every new
        # block's id and signer again itself. On RPC_VERIFY (a third node) when one is set, else on RPC_CHECK.
        v = os.environ.get("RPC_VERIFY", "").strip() or os.environ.get("RPC_CHECK", "").strip()
        if not v:
            errs.append("no node to check the blocks on: set RPC_CHECK (or RPC_VERIFY)")
        else:
            try:
                errs.extend(verify_blocks(new_hours, v))
            except Exception as e:
                errs.append("couldn't check the blocks independently (%s); tried again next run" % str(e)[:200])
    for w in warns:
        print("::warning::" + w)
    for e in errs:
        print("::error::" + e)
    if not errs:
        print("ok: %d new hour(s), %d new day(s), %d removal(s); every new block checked independently" % (
            len(new_hours), sum(1 for p in incoming if p.startswith("d/") and p not in published), len(removals)))
    return 1 if errs else 0


def load_ledger(data_dir):
    """A Ledger over the published vhp-data (h/ and d/ files), every hour checked in order. For a game's publish job:
    recompute its cards from the ruler's data (§7). Returns (Ledger, checks)."""
    tree, _ = _read_tree(data_dir)
    texts = {}
    for p, t in tree.items():
        m = _DAY_FILE.fullmatch(p)
        if m:
            d = json.loads(t)
            for i, hr in enumerate(d["hours"]):
                texts[d["n"] * 24 + i] = canon(hr)
    for p, t in tree.items():
        m = _HOUR_FILE.fullmatch(p)
        if m:
            texts[int(m.group(1))] = t
    ns = sorted(texts)
    if not ns or ns != list(range(ns[0], ns[0] + len(ns))):
        raise ValueError("the vhp-data hours aren't consecutive")
    checks, prev = [], None
    for n in ns:
        t = texts[n]
        # the oldest kept hour starts the chain (older ones were removed after retention)
        r = check_hour(prev, t) if prev is not None else _first_kept(t)
        if not r["ok"]:
            raise ValueError("h/%d.json: %s" % (n, r["why"]))
        checks.append(r)
        prev = t
    return Ledger(timeline_from([json.loads(texts[n]) for n in ns], checks)), checks


def check_kept(text):
    """The oldest KEPT hour (its predecessor removed after retention): its own checks without the chain link, as
    checkKept in vhp-data.js. A chained one is checked like a rebuilt one (Repo Lens #B-5 / #E-14 N-4)."""
    try:
        h = json.loads(text)
    except Exception:
        return _fail("not JSON")
    if not isinstance(h, dict):
        return _fail("not an hour")
    stub = dict(h)
    stub["prev"] = ""
    if stub.get("kind") == "chained":
        stub["kind"] = "rebuilt"
    r = check_hour("", canon(stub))
    if r["ok"]:
        r = dict(r)
        r["hash"] = sha_hex(text)
    return r


def _first_kept(t):
    r = check_kept(t)
    if not r["ok"]:
        raise ValueError("h/%s.json: %s" % (_num_inside(t), r["why"]))
    return r


def recompute_main(argv):
    """argv: vhp-data dir, card file, the game's settings (a JSON file: {game, round, window, c, minK, poolRule, ownRule,
    paying, pooled}, from the game's own code, never from the card). Exit 0 = the card is exactly what the data gives."""
    L, _ = load_ledger(argv[0])
    with open(argv[1], encoding="utf-8") as fh:
        card = fh.read()
    with open(argv[2], encoding="utf-8") as fh:
        game = json.load(fh)
    same, diff = recompute(L, card, game)
    print("ok: the card matches the ruler's data" if same else "::error::the card doesn't match the ruler's data: " + diff)
    return 0 if same else 1
