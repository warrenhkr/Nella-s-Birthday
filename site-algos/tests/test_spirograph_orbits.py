"""Tests de spirograph_orbits. Lancer : python tests/test_spirograph_orbits.py"""
import math
from _harness import load, check_standard, run_tests

algo = load("spirograph_orbits")


def test_standard():
    check_standard(algo, "points")


def test_courbe_fermee():
    for R, r in ((120, 47), (100, 40), (60, 60), (200, 5)):
        out = algo.run({"R": R, "r": r})
        a, b = out["points"][0], out["points"][-1]
        assert math.hypot(a["x"] - b["x"], a["y"] - b["y"]) < 0.05, (R, r)


def test_tours_avec_pgcd():
    assert algo.run({"R": 120, "r": 47})["turns"] == 47
    assert algo.run({"R": 100, "r": 40})["turns"] == 2
    assert algo.run({"R": 60, "r": 60})["turns"] == 1


def test_liens_en_chaine():
    out = algo.run({})
    n = len(out["points"])
    assert out["links"] == [[i, i + 1] for i in range(n - 1)]


if __name__ == "__main__":
    run_tests(globals())
