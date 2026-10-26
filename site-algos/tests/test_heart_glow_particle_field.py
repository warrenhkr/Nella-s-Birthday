"""Tests de heart_glow_particle_field. Lancer : python tests/test_heart_glow_particle_field.py"""
import numpy as np
from _harness import load, check_standard, run_tests

algo = load("heart_glow_particle_field")


def test_standard():
    check_standard(algo, "points")


def test_rejection_sampling_dans_le_coeur():
    rng = np.random.default_rng(0)
    xy = algo.sample_heart(rng, 5000)
    assert len(xy) == 5000
    assert algo.heart_inside(xy[:, 0], xy[:, 1]).all()


def test_distribution_uniforme():
    rng = np.random.default_rng(1)
    xy = algo.sample_heart(rng, 20000)
    left = (xy[:, 0] < 0).mean()
    assert abs(left - 0.5) < 0.02, "autant de points à gauche qu'à droite"
    # la proportion de points proche du centre doit refléter l'aire (pas de grappe)
    r = np.hypot(xy[:, 0], xy[:, 1])
    area_frac = (r < 0.5).mean()
    expected = np.pi * 0.25 / 2.0  # ~ aire du disque 0.5 / aire du coeur (≈ 2.0) : ordre de grandeur
    assert 0.5 * expected < area_frac < 1.6 * expected


def test_points_dans_le_coeur_a_l_ecran():
    out = algo.run({"glow": 0.0})
    inside = 0
    for q in out["points"]:
        x, y = (q["x"] - 320) / 1.0, (320 - q["y"]) / 1.0
        s = (320 - algo.margin_of(algo.read_params({}, algo.PARAMS), 1.6)) / algo.HEART_IN_HALF
        inside += bool(algo.heart_inside(np.array(x / s), np.array(y / s)))
    assert inside >= 0.97 * len(out["points"])


def test_halo():
    plain = algo.run({"glow": 0.0})
    halo = algo.run({"glow": 1.0})
    assert len(halo["points"]) == 2 * len(plain["points"])
    assert max(q["r"] for q in halo["points"]) > 2 * max(q["r"] for q in plain["points"])


def test_scintillement_en_boucle():
    out = algo.run({"frames": 8, "glow": 0.0})
    assert len(out["keyframes"]) == 8 and out["loop"] is True
    assert out["keyframes"][0] != out["keyframes"][2]
    xs = lambda f: [(q["x"], q["y"]) for q in f["points"]]
    assert xs(out["keyframes"][0]) == xs(out["keyframes"][5]), "les positions ne bougent pas"


if __name__ == "__main__":
    run_tests(globals())
