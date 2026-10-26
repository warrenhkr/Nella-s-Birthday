"""Tests de heart_bloom_trail. Lancer : python tests/test_heart_bloom_trail.py"""
from _harness import load, check_standard, run_tests

algo = load("heart_bloom_trail")


def test_standard():
    check_standard(algo, "points")


def test_nombre_de_points_par_image():
    out = algo.run({"heads": 3, "trail": 20, "frames": 30})
    assert all(len(f["points"]) == 60 for f in out["keyframes"])


def test_alpha_decroit_et_taille_croit_avec_l_age():
    out = algo.run({"heads": 1, "trail": 30, "bloom": 2.0})
    pts = out["keyframes"][10]["points"]
    alphas = [q["alpha"] for q in pts]
    sizes = [q["r"] for q in pts]
    assert alphas == sorted(alphas, reverse=True) and alphas[0] > 0.99 and alphas[-1] < 0.1
    assert sizes == sorted(sizes) and sizes[-1] > sizes[0]


def test_boucle_sans_saut():
    n, trail = 40, 25
    out = algo.run({"heads": 1, "trail": trail, "frames": n})
    kf = out["keyframes"]
    for age in range(trail):
        # le point d'âge `age` à l'image 0 est la tête de l'image (0 - age) modulo n
        a = kf[0]["points"][age]
        b = kf[(-age) % n]["points"][0]
        assert (a["x"], a["y"]) == (b["x"], b["y"]), age


def test_tete_avance_regulierement():
    import math
    out = algo.run({"heads": 1, "frames": 60, "trail": 5})
    heads = [f["points"][0] for f in out["keyframes"]]
    moves = [math.dist((a["x"], a["y"]), (b["x"], b["y"])) for a, b in zip(heads, heads[1:])]
    assert min(moves) > 0 and max(moves) < 80 and sum(moves) > 1000, (min(moves), max(moves))


def test_bloom_zero_taille_constante():
    out = algo.run({"bloom": 0.0, "size": 3.0})
    assert {q["r"] for q in out["keyframes"][3]["points"]} == {3.0}


if __name__ == "__main__":
    run_tests(globals())
