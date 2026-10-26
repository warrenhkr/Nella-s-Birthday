"""Tests de morphing_heart_contour. Lancer : python tests/test_morphing_heart_contour.py"""
import numpy as np
from _harness import load, check_standard, run_tests

algo = load("morphing_heart_contour")


def test_standard():
    check_standard(algo, "points")


def test_boucle_exacte():
    for seed in (1, 2):
        p = algo.read_params({"seed": seed}, algo.PARAMS)
        n, shape_at = algo.build(p)
        x0, y0 = shape_at(0)
        xn, yn = shape_at(n)
        assert np.allclose(x0, xn, atol=1e-9) and np.allclose(y0, yn, atol=1e-9)


def test_cercle_au_depart_coeur_au_milieu():
    p = algo.read_params({"noise": 0.0, "frames": 30}, algo.PARAMS)
    n, shape_at = algo.build(p)
    x, y = shape_at(0)
    r = np.hypot(x, y)
    assert r.std() < 1e-9 and abs(r.mean() - algo.CIRCLE_RADIUS) < 1e-9, "image 0 = cercle"
    xm, ym = shape_at(n // 2)
    hx, hy = algo.heart_curve((np.arange(p["samples"]) + 0.5) * (2 * np.pi / p["samples"]))
    assert np.allclose(xm, hx) and np.allclose(ym, hy), "à mi-parcours = coeur exact"


def test_contour_continu_et_ferme():
    out = algo.run({"noise": 1.0, "harmonics": 8})
    for frame in out["keyframes"]:
        pts = np.array([[q["x"], q["y"]] for q in frame["points"]])
        steps = np.hypot(*(np.roll(pts, -1, axis=0) - pts).T)  # inclut le pas de fermeture
        assert steps.max() < 4 * np.median(steps) + 2, "pas de saut dans le contour"
    assert all(a != b for a, b in zip(out["links"], out["links"][1:]))
    assert out["links"][-1] == [len(out["links"]) - 1, 0]


def test_bruit_change_la_forme():
    a = algo.run({"noise": 0.0})["keyframes"][3]
    b = algo.run({"noise": 1.0})["keyframes"][3]
    assert a != b


if __name__ == "__main__":
    run_tests(globals())
