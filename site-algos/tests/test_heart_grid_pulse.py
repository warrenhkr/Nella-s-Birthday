"""Tests de heart_grid_pulse. Lancer : python tests/test_heart_grid_pulse.py"""
import numpy as np
from _harness import load, check_standard, run_tests

algo = load("heart_grid_pulse")


def test_standard():
    check_standard(algo, "grid")


def test_masque_symetrique_et_non_vide():
    for g in (16, 33, 48, 120):
        m = algo.heart_mask(g)
        assert np.array_equal(m, m[:, ::-1]), "coeur symétrique gauche-droite"
        assert 0.3 * g * g < m.sum() < 0.8 * g * g


def test_hors_coeur_toujours_eteint():
    out = algo.run({})
    mask = np.array(out["mask"], dtype=bool)
    for frame in out["keyframes"]:
        assert np.array(frame)[~mask].sum() == 0


def test_boucle_et_onde_qui_bouge():
    p = algo.read_params({}, algo.PARAMS)
    n, frame_at, _ = algo.build(p)
    assert np.abs(frame_at(n) - frame_at(0)).max() <= 1  # arrondi près
    assert not np.array_equal(frame_at(0), frame_at(3))


def test_onde_centrale_symetrique():
    p = algo.read_params({"grid_size": 49}, algo.PARAMS)
    n, frame_at, _ = algo.build(p)
    f = frame_at(5)
    assert np.array_equal(f, f[:, ::-1]) and np.array_equal(f[:, :], f[:, ::-1])


if __name__ == "__main__":
    run_tests(globals())
