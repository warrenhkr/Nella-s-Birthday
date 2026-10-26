"""Tests de game_of_life_heart. Lancer : python tests/test_game_of_life_heart.py"""
import numpy as np
from _harness import load, check_standard, run_tests

algo = load("game_of_life_heart")


def grid(rows):
    return np.array([[1 if ch == "#" else 0 for ch in row] for row in rows], dtype=np.uint8)


def test_standard():
    check_standard(algo, "grid")


def test_clignotant():
    h = grid([".....", ".....", ".###.", ".....", "....."])
    v = grid([".....", "..#..", "..#..", "..#..", "....."])
    assert np.array_equal(algo.life_step(h, False), v)
    assert np.array_equal(algo.life_step(v, False), h)


def test_bloc_stable():
    b = grid([".....", ".##..", ".##..", ".....", "....."])
    assert np.array_equal(algo.life_step(b, True), b)


def test_naissance_et_survie():
    # une cellule isolée meurt ; 3 voisines font naître la case centrale vide
    seul = grid(["...", ".#.", "..."])
    assert algo.life_step(seul, False).sum() == 0
    trois = grid(["##.", "#..", "..."])
    assert algo.life_step(trois, False)[1, 1] == 1


def test_mise_a_jour_simultanee_sans_toucher_l_entree():
    g = grid([".....", ".....", ".###.", ".....", "....."])
    copie = g.copy()
    algo.life_step(g, True)
    assert np.array_equal(g, copie), "la grille d'entrée ne doit pas être modifiée"


def test_planeur_traverse_le_bord_seulement_avec_wrap():
    g = np.zeros((8, 8), dtype=np.uint8)
    for r, c in ((0, 1), (1, 2), (2, 0), (2, 1), (2, 2)):
        g[r, c] = 1
    a, b = g.copy(), g.copy()
    for _ in range(40):
        a, b = algo.life_step(a, True), algo.life_step(b, False)
    assert a.sum() == 5, "sur un tore le planeur survit"
    assert b.sum() != 5, "sans wrap il s'écrase contre le bord"


def test_arret_anticipe_et_depart_dans_le_coeur():
    out = algo.run({"grid_size": 20, "steps": 300, "initial_density": 0.05})
    assert len(out["keyframes"]) <= 300
    first = np.array(out["keyframes"][0])
    mask = algo.heart_mask(20)
    assert first[~mask].sum() == 0, "au départ, aucune cellule vivante hors du coeur"
    assert set(np.unique(first)) <= {0, 1}


if __name__ == "__main__":
    run_tests(globals())
