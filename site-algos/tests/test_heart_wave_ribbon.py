"""Tests de heart_wave_ribbon. Lancer : python tests/test_heart_wave_ribbon.py"""
from _harness import load, check_standard, run_tests

algo = load("heart_wave_ribbon")


def test_standard():
    check_standard(algo, "points")


def test_liens_valides():
    out = algo.run({})
    n = len(out["points"])
    assert len(out["links"]) == n  # deux anneaux fermés : autant de liens que de points
    assert all(0 <= a < n and 0 <= b < n for a, b in out["links"])
    assert 0 < out["link_alpha"] <= 1


def test_amplitude_zero_donne_deux_bords_reguliers():
    out = algo.run({"amplitude": 0.0, "frames": 4})
    assert out["keyframes"][0] == out["keyframes"][2], "sans vague, plus rien ne bouge"


def test_animation_boucle():
    out = algo.run({"frames": 10, "amplitude": 12})
    assert out["keyframes"][0] != out["keyframes"][1]
    assert out["loop"] is True


def test_normales_unitaires():
    import numpy as np
    t = (np.arange(200) + 0.5) * (2 * np.pi / 200)
    nx, ny = algo._normals(t)
    assert np.allclose(np.hypot(nx, ny), 1.0, atol=1e-9)
    hx, hy = algo.heart_curve(t)
    # la normale sortante pointe à l'opposé du centre
    assert (nx * hx + ny * hy > -1e-6).mean() > 0.95


if __name__ == "__main__":
    run_tests(globals())
