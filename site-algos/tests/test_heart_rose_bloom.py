"""Tests de heart_rose_bloom. Lancer : python tests/test_heart_rose_bloom.py"""
import numpy as np
from _harness import load, check_standard, run_tests

algo = load("heart_rose_bloom")


def peaks(k, samples=1440):
    x, y = algo.rose_xy(k, samples)
    r = np.hypot(x, y)
    return int(((r > np.roll(r, 1)) & (r >= np.roll(r, -1)) & (r > 0.9)).sum())


def test_standard():
    check_standard(algo, "points")


def test_nombre_de_petales():
    for k in (3, 5, 7, 9, 11):
        assert peaks(k) == k, k  # k impair : k pétales
    for k in (2, 4, 6, 8, 12):
        assert peaks(k) == 2 * k, k  # k pair : 2k pétales
    assert algo.run({"k": 5})["petals"] == 5 and algo.run({"k": 4})["petals"] == 8


def test_courbe_fermee_et_rayon_un():
    for k in (2, 3, 8):
        x, y = algo.rose_xy(k, 720)
        assert abs(np.hypot(x, y).max() - 1.0) < 1e-3
        step = np.hypot(np.diff(x), np.diff(y)).max()
        closing = np.hypot(x[0] - x[-1], y[0] - y[-1])
        assert closing < 2 * step, "le dernier point est tout près du premier"


def test_structure_des_liens():
    out = algo.run({"layers": 3, "samples": 200, "heart_center": True})
    assert len(out["points"]) == 3 * 200 + algo.HEART_POINTS
    assert len(out["links"]) == len(out["points"])  # anneaux fermés
    assert all(0 <= a < len(out["points"]) and 0 <= b < len(out["points"]) for a, b in out["links"])
    sans = algo.run({"layers": 3, "samples": 200, "heart_center": False})
    assert len(sans["points"]) == 600


def test_couches_plus_petites():
    out = algo.run({"layers": 3, "samples": 200, "heart_center": False, "rotation": 0.0})
    def radius(layer):
        pts = out["points"][layer * 200:(layer + 1) * 200]
        return max(np.hypot(q["x"] - 320, q["y"] - 320) for q in pts)
    assert radius(0) > radius(1) > radius(2)


if __name__ == "__main__":
    run_tests(globals())
