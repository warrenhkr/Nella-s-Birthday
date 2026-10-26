"""Outils communs aux tests des algos analyste (à ne pas lancer seul).

check_standard(module, type_attendu) vérifie, pour n'importe quel algo : structure, JSON natif, déterminisme,
seed, valeurs min / max de chaque paramètre, valeurs invalides rejetées (ValueError), canvas de tailles
différentes et temps d'exécution. Pour les images : PNG décodable aux dimensions annoncées.
"""
import base64
import importlib
import io
import json
import os
import sys
import time

ALGOS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "public", "algos")
sys.path.insert(0, ALGOS_DIR)


def load(name):
    return importlib.import_module(name)


def defaults(mod):
    return {s["name"]: s["default"] for s in mod.PARAMS}


def decode_png(uri):
    from PIL import Image
    assert uri.startswith("data:image/png;base64,")
    return Image.open(io.BytesIO(base64.b64decode(uri.split(",", 1)[1])))


def timed(f, *args, repeat=3):
    best = float("inf")
    for _ in range(repeat):
        t0 = time.perf_counter()
        f(*args)
        best = min(best, time.perf_counter() - t0)
    return best


def extreme_sets(mod):
    base = defaults(mod)
    sets, mins, maxs = [], dict(base), dict(base)
    for s in mod.PARAMS:
        if s["type"] in ("int", "float"):
            mins[s["name"]], maxs[s["name"]] = s["min"], s["max"]
            for v in (s["min"], s["max"]):
                one = dict(base)
                one[s["name"]] = v
                sets.append(one)
        elif s["type"] == "select":
            for v in s["options"]:
                one = dict(base)
                one[s["name"]] = v
                sets.append(one)
    return sets + [mins, maxs]


def check_output(out, expected_type, width=640, height=640):
    assert out["type"] == expected_type, "type attendu %s, reçu %s" % (expected_type, out["type"])
    json.dumps(out)  # échoue si un type numpy se glisse dans la sortie
    if expected_type == "image":
        img = decode_png(out["data"])
        assert img.size == (out["width"], out["height"]), "dimensions annoncées = dimensions réelles"
    if expected_type == "points":
        for q in out["points"]:
            assert 0 <= q["x"] <= width and 0 <= q["y"] <= height, "point hors canvas : %r" % (q,)
            assert set(q) == {"x", "y", "r", "alpha", "color"}
            assert type(q["x"]) is float and type(q["y"]) is float
    if expected_type == "text":
        assert out["lines"] and all(isinstance(l, str) for l in out["lines"])
    if expected_type == "grid":
        assert len(out["cells"]) == out["rows"] and all(len(r) == out["cols"] for r in out["cells"])


def check_standard(mod, expected_type, seed_changes=True, max_time=1.0):
    out = mod.run({})
    check_output(out, expected_type)
    assert mod.run({}) == out, "mêmes paramètres : même sortie"
    names = [s["name"] for s in mod.PARAMS]
    if "seed" in names:
        a = mod.run({"seed": 1})
        assert a == mod.run({"seed": 1}), "même seed : même sortie"
        if seed_changes:
            assert a != mod.run({"seed": 2}), "seed différente : sortie différente"
    for ps in extreme_sets(mod):
        try:
            check_output(mod.run(ps), expected_type)
        except ValueError:
            # seules les combinaisons physiquement impossibles (ex. prix <= coût) ont le droit d'être refusées
            assert "price" in ps and ps.get("price", 0) <= ps.get("unit_cost", 0), "refus inattendu pour %r" % ps
    for s in mod.PARAMS:
        if s["type"] in ("int", "float"):
            for bad in (s["min"] - 1, s["max"] + 1):
                try:
                    mod.run({s["name"]: bad})
                except ValueError:
                    continue
                raise AssertionError("ValueError attendue pour %s=%r" % (s["name"], bad))
    for bad in ({"width": 10}, {"height": 99999}, {"width": "large"}):
        try:
            mod.run(bad)
        except ValueError:
            continue
        raise AssertionError("ValueError attendue pour %r" % bad)
    if expected_type in ("points", "image"):
        for w, h in ((64, 64), (320, 480), (900, 400)):
            o = mod.run({"width": w, "height": h})
            check_output(o, expected_type, w, h)
    dt = timed(mod.run, {})
    assert dt < max_time, "trop lent aux valeurs par défaut : %.3f s" % dt
    return dt


def run_tests(globs):
    tests = [v for k, v in sorted(globs.items()) if k.startswith("test_")]
    for t in tests:
        t0 = time.perf_counter()
        t()
        print("OK  %-40s %6.0f ms" % (t.__name__, (time.perf_counter() - t0) * 1000))
    print("%d tests réussis" % len(tests))
