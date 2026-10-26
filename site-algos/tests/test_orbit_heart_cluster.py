"""Tests de orbit_heart_cluster. Lancer : python tests/test_orbit_heart_cluster.py"""
import math
import numpy as np
from _harness import load, check_standard, run_tests

algo = load("orbit_heart_cluster")


def test_standard():
    check_standard(algo, "points")


def test_rotation_conserve_la_distance():
    pts = [(3, 4), (-2.5, 1), (0, 7)]
    for theta in (0.3, 1.9, -2.2):
        for c in ((0, 0), (5, -1)):
            for q in pts:
                r = algo.rotate(q, c, theta)
                assert abs(math.dist(q, c) - math.dist(r, c)) < 1e-9
    x, y = algo.rotate((1, 0), (0, 0), math.pi / 2)
    assert abs(x) < 1e-9 and abs(y - 1) < 1e-9


def test_coeurs_restent_sur_leur_anneau():
    p = {"rings": 2, "hearts": 5, "points_per_heart": 20, "frames": 24}
    out = algo.run(p)
    m = 20
    dists = {}
    for frame in out["keyframes"]:
        pts = np.array([[q["x"], q["y"]] for q in frame["points"]])
        for h in range(2 * 5):
            c = pts[h * m:(h + 1) * m].mean(axis=0)
            dists.setdefault(h, []).append(math.dist(c, (320, 320)))
    for h, d in dists.items():
        assert max(d) - min(d) < 1.5, "la distance au centre est constante pour le coeur %d" % h


def test_boucle_et_sens_opposes():
    out = algo.run({"frames": 12, "rings": 2})
    kf = out["keyframes"]
    assert kf[0] != kf[1] and out["loop"] is True
    m = 16 * 6
    a0 = math.atan2(kf[0]["points"][0]["y"] - 320, kf[0]["points"][0]["x"] - 320)
    a1 = math.atan2(kf[1]["points"][0]["y"] - 320, kf[1]["points"][0]["x"] - 320)
    b0 = math.atan2(kf[0]["points"][m]["y"] - 320, kf[0]["points"][m]["x"] - 320)
    b1 = math.atan2(kf[1]["points"][m]["y"] - 320, kf[1]["points"][m]["x"] - 320)
    wrap = lambda a: (a + math.pi) % (2 * math.pi) - math.pi
    assert wrap(a1 - a0) * wrap(b1 - b0) < 0, "les deux anneaux tournent en sens inverse"


def test_petit_canvas_gros_coeurs_restent_dedans():
    from _harness import check_bounds
    out = algo.run({"width": 64, "height": 64, "heart_size": 40, "rings": 4})
    check_bounds(out, 64, 64)


if __name__ == "__main__":
    run_tests(globals())
