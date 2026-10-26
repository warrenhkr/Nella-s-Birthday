"""Tests de lsystem_heart_tree. Lancer : python tests/test_lsystem_heart_tree.py"""
import math
import numpy as np
from _harness import load, check_standard, run_tests

algo = load("lsystem_heart_tree")


def test_standard():
    check_standard(algo, "points")


def test_reecriture():
    assert algo.expand("F", algo.RULES, 0) == "F"
    assert algo.expand("F", algo.RULES, 1) == "F[+F][-F]"
    assert algo.expand("F", algo.RULES, 2) == "F[+F][-F][+F[+F][-F]][-F[+F][-F]]"
    assert algo.expand("a", {"a": "ab", "b": "a"}, 5) == "abaababa" "abaab"  # suite de Fibonacci
    for n in range(1, 8):
        assert algo.expand("F", algo.RULES, n).count("F") == 3 ** n


def test_branches_et_extremites():
    for n in range(1, 8):
        out = algo.run({"iterations": n})
        assert out["branches"] == 3 ** n == len(out["links"])
        assert out["tips"] == 2 ** n


def test_les_coeurs_n_apparaissent_qu_aux_extremites():
    p = algo.read_params({"iterations": 5, "leaf_size": 10.0}, algo.PARAMS)
    b = algo.build(p)
    out = algo.run({"iterations": 5, "leaf_size": 10.0})
    n_nodes = len(b["px"])
    assert len(out["points"]) == n_nodes + 14 * len(b["tips"])
    tips_xy = [(b["px"][t], b["py"][t]) for t in b["tips"]]
    for q in out["points"][n_nodes:]:
        assert min(math.hypot(q["x"] - x, q["y"] - y) for x, y in tips_xy) < 0.6 * 10.0 + 1
    for a, c in out["links"]:
        assert a < n_nodes and c < n_nodes, "les liens ne touchent pas les coeurs"
    assert set(b["tips"]).isdisjoint({a for a, _ in b["links"]}), "une extrémité n'a pas d'enfant"


def test_tout_reste_dans_le_canvas_meme_en_petit():
    for w, h in ((64, 64), (200, 600), (640, 300)):
        out = algo.run({"iterations": 7, "leaf_size": 16.0, "width": w, "height": h})
        for q in out["points"]:
            assert 0 <= q["x"] <= w and 0 <= q["y"] <= h


def test_branches_raccourcissent_avec_la_profondeur():
    p = algo.read_params({"iterations": 4, "angle": 20.0}, algo.PARAMS)
    b = algo.build(p)
    lengths = {}
    for (i, j) in b["links"]:
        d = b["depth"][j]
        lengths.setdefault(d, []).append(math.hypot(b["px"][j] - b["px"][i], b["py"][j] - b["py"][i]))
    means = [np.mean(lengths[d]) for d in sorted(lengths)]
    assert all(a > b for a, b in zip(means, means[1:]))
    assert abs(means[1] / means[0] - p["length_ratio"]) < 0.02, "chaque niveau vaut ratio x le précédent"


def test_graine_change_l_arbre():
    assert algo.run({"seed": 1}) != algo.run({"seed": 2})


if __name__ == "__main__":
    run_tests(globals())
