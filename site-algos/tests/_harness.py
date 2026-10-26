"""Outils communs aux tests des algos (à ne pas lancer seul).

check_standard(module, type_attendu) vérifie, pour n'importe quel algo :
  structure, JSON natif, déterminisme, seed, bornes du canvas, valeurs min/max,
  valeurs invalides rejetées (ValueError), canvas de tailles différentes, temps d'exécution.
"""
import importlib
import itertools
import json
import os
import sys
import time

ALGOS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "algos")
sys.path.insert(0, ALGOS_DIR)


def load(name):
    return importlib.import_module(name)


def defaults(mod):
    return {s["name"]: s["default"] for s in mod.PARAMS}


def _point_lists(out):
    """Toutes les listes de points d'un rendu (principal + keyframes)."""
    lists = []
    if "points" in out:
        lists.append(out["points"])
    for kf in out.get("keyframes", []):
        if isinstance(kf, dict) and "points" in kf:
            lists.append(kf["points"])
    return lists


def check_bounds(out, width, height):
    for pts in _point_lists(out):
        for q in pts:
            assert 0 <= q["x"] <= width and 0 <= q["y"] <= height, "point hors canvas : %r" % (q,)


def check_points_shape(out):
    for pts in _point_lists(out):
        for q in pts[:50]:
            assert set(q) == {"x", "y", "r", "alpha", "color"}, "clés inattendues : %r" % sorted(q)
            assert type(q["x"]) is float and type(q["y"]) is float and type(q["r"]) is float
            assert 0 <= q["alpha"] <= 1


def timed(f, *args, repeat=3):
    best = float("inf")
    for _ in range(repeat):
        t0 = time.perf_counter()
        f(*args)
        best = min(best, time.perf_counter() - t0)
    return best


def extreme_sets(mod):
    """Jeux de paramètres : tout au min, tout au max, et chaque paramètre seul à son min / max."""
    base = defaults(mod)
    sets = []
    mins, maxs = dict(base), dict(base)
    for s in mod.PARAMS:
        if s["type"] in ("int", "float"):
            mins[s["name"]], maxs[s["name"]] = s["min"], s["max"]
            for v in (s["min"], s["max"]):
                one = dict(base)
                one[s["name"]] = v
                sets.append(one)
        elif s["type"] == "bool":
            for v in (True, False):
                one = dict(base)
                one[s["name"]] = v
                sets.append(one)
        elif s["type"] == "select":
            for v in s["options"]:
                one = dict(base)
                one[s["name"]] = v
                sets.append(one)
    sets += [mins, maxs]
    return sets


def check_standard(mod, expected_type, seed_changes=True, max_time=1.0, bounds=True, canvases=True):
    # 1. structure + JSON natif
    out = mod.run({})
    assert out["type"] == expected_type, "type attendu %s, reçu %s" % (expected_type, out["type"])
    json.dumps(out)
    if expected_type == "points":
        check_points_shape(out)
        if bounds:
            check_bounds(out, 640, 640)
    # 2. déterminisme et seed
    assert mod.run({}) == out, "même paramètres : même sortie"
    names = [s["name"] for s in mod.PARAMS]
    if "seed" in names:
        a, b = mod.run({"seed": 1}), mod.run({"seed": 1})
        assert a == b, "même seed : même sortie"
        if seed_changes:
            assert a != mod.run({"seed": 2}), "seed différente : sortie différente"
    # 3. valeurs extrêmes
    for ps in extreme_sets(mod):
        o = mod.run(ps)
        json.dumps(o)
        if expected_type == "points" and bounds:
            check_bounds(o, 640, 640)
    # 4. valeurs invalides rejetées
    for s in mod.PARAMS:
        if s["type"] in ("int", "float"):
            for bad in (s["min"] - 1, s["max"] + 1):
                try:
                    mod.run({s["name"]: bad})
                except ValueError:
                    continue
                raise AssertionError("ValueError attendue pour %s=%r" % (s["name"], bad))
        elif s["type"] == "select":
            try:
                mod.run({s["name"]: "__inconnu__"})
            except ValueError:
                continue
            raise AssertionError("ValueError attendue pour select %s" % s["name"])
    for bad in ({"width": 10}, {"height": 99999}, {"width": "large"}):
        try:
            mod.run(bad)
        except ValueError:
            continue
        raise AssertionError("ValueError attendue pour %r" % bad)
    # 5. autres tailles de canvas
    if canvases and expected_type == "points" and bounds:
        for w, h in ((64, 64), (320, 480), (900, 400)):
            o = mod.run({"width": w, "height": h})
            check_bounds(o, w, h)
    # 6. temps
    dt = timed(mod.run, {})
    assert dt < max_time, "trop lent aux valeurs par défaut : %.3f s" % dt
    return dt


def run_tests(globs):
    tests = [v for k, v in sorted(globs.items()) if k.startswith("test_")]
    for t in tests:
        t0 = time.perf_counter()
        t()
        print("OK  %-34s %6.0f ms" % (t.__name__, (time.perf_counter() - t0) * 1000))
    print("%d tests réussis" % len(tests))
