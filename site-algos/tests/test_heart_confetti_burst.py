"""Tests de heart_confetti_burst. Lancer : python tests/test_heart_confetti_burst.py"""
import numpy as np
from _harness import load, check_standard, run_tests

algo = load("heart_confetti_burst")


def spread(frame):
    pts = np.array([[q["x"], q["y"]] for q in frame["points"]])
    return np.hypot(pts[:, 0] - 320, pts[:, 1] - 320).mean()


def test_standard():
    check_standard(algo, "points")


def test_l_explosion_s_eloigne_du_centre():
    out = algo.run({"gravity": 0.0})
    kf = out["keyframes"]
    assert spread(kf[-1]) > spread(kf[0]) * 1.5


def test_frottement_fort_immobilise():
    p = algo.read_params({"friction": 0.8, "gravity": 0.0, "frames": 60}, algo.PARAMS)
    history = algo.simulate(p)[0]
    assert np.abs(history[-1] - history[-2]).max() < 0.5, "presque à l'arrêt"


def test_gravite_fait_descendre():
    base = algo.simulate(algo.read_params({"gravity": 0.0, "seed": 3}, algo.PARAMS))[0]
    fall = algo.simulate(algo.read_params({"gravity": 0.5, "seed": 3}, algo.PARAMS))[0]
    assert fall[-1][:, 1].mean() > base[-1][:, 1].mean()


def test_opacite_decroit_avec_l_age():
    out = algo.run({})
    mean_alpha = [np.mean([q["alpha"] for q in f["points"]]) for f in out["keyframes"]]
    assert mean_alpha[0] > mean_alpha[-1]
    assert all(a >= b - 1e-9 for a, b in zip(mean_alpha, mean_alpha[1:]))


def test_depart_sur_le_contour_du_coeur():
    p = algo.read_params({"seed": 9}, algo.PARAMS)
    start = algo.simulate(p)[0][0]
    xs, ys = start[:, 0] - 320, 320 - start[:, 1]
    assert abs(xs).max() < 320 and abs(ys).max() < 320
    assert len({(round(a), round(b)) for a, b in zip(xs, ys)}) > 100


if __name__ == "__main__":
    run_tests(globals())
