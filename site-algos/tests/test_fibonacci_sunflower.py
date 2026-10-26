"""Tests de fibonacci_sunflower. Lancer : python tests/test_fibonacci_sunflower.py"""
import math
from _harness import load, check_standard, run_tests

algo = load("fibonacci_sunflower")


def radii(out):
    return [math.hypot(q["x"] - 320, q["y"] - 320) for q in out["points"]]


def test_standard():
    check_standard(algo, "points")


def test_rayon_croissant_sans_trou_au_centre():
    out = algo.run({"count": 900})
    r = radii(out)
    assert r[0] < 0.05 * max(r), "le premier point doit être tout près du centre"
    assert all(r[i] <= r[i + 1] + 0.1 for i in range(len(r) - 1)), "rayon croissant (à l'arrondi près)"


def test_pas_de_points_confondus():
    out = algo.run({"count": 900})
    seen = {(q["x"], q["y"]) for q in out["points"]}
    assert len(seen) >= 0.98 * len(out["points"])


def test_angle_d_or_repartit_mieux_que_90():
    def empty_sectors(angle):
        out = algo.run({"count": 600, "angle": angle, "spread": 7})
        ang = [math.atan2(q["y"] - 320, q["x"] - 320) % (2 * math.pi) for q in out["points"][300:]]
        sectors = {int(a / (2 * math.pi) * 36) for a in ang}
        return 36 - len(sectors)
    assert empty_sectors(137.5) == 0
    assert empty_sectors(120.0) > 0  # 120 deg = 3 directions seulement


def test_rotation_keyframes():
    out = algo.run({"frames": 6})
    assert len(out["keyframes"]) == 6 and out["loop"] is True
    assert out["keyframes"][0] != out["keyframes"][1]


if __name__ == "__main__":
    run_tests(globals())
