"""Tests de heart_pulse_points. Lancer : python tests/test_heart_pulse_points.py"""
from _harness import load, check_standard, run_tests

algo = load("heart_pulse_points")


def test_standard():
    check_standard(algo, "points")


def test_boucle_sans_saut():
    out = algo.run({"frames": 24})
    kf = out["keyframes"]
    assert len(kf) == 24 and out["loop"] is True
    # l'image 0 est l'échelle de base (sin 0 = 0) : l'image suivante la dernière doit en être proche
    def spread(frame):
        xs = [q["x"] for q in frame["points"]]
        return max(xs) - min(xs)
    steps = [abs(spread(kf[i]) - spread(kf[(i + 1) % 24])) for i in range(24)]
    assert max(steps) < 0.2 * spread(kf[0]), "saut visible dans la boucle"


def test_pulsation_effective():
    out = algo.run({"pulse": 0.2, "frames": 24})
    widths = [max(q["x"] for q in f["points"]) - min(q["x"] for q in f["points"]) for f in out["keyframes"]]
    assert max(widths) > min(widths) * 1.15
    flat = algo.run({"pulse": 0.0, "frames": 8})
    assert flat["keyframes"][0] == flat["keyframes"][3]


def test_symetrie_gauche_droite():
    out = algo.run({"layers": 1, "count": 100, "pulse": 0.0, "frames": 4})
    xs = sorted(q["x"] for q in out["points"])
    assert abs((xs[0] + xs[-1]) / 2 - 320) < 1.0


if __name__ == "__main__":
    run_tests(globals())
