"""Tests de matrix_rain_violet. Lancer : python tests/test_matrix_rain_violet.py"""
import numpy as np
from _harness import load, check_standard, run_tests

algo = load("matrix_rain_violet")


def test_standard():
    check_standard(algo, "grid")


def test_boucle_exacte():
    for seed in (1, 2, 3):
        p = algo.read_params({"seed": seed}, algo.PARAMS)
        n, frame_at = algo.build(p)
        assert np.array_equal(frame_at(n), frame_at(0)), "l'image n doit être identique à l'image 0"


def test_traine_decroissante():
    for tail in (3, 8, 20):
        col = algo.trail_column(head=25, rows=30, tail=tail)
        run_vals = [col[25 - d] for d in range(tail)]
        assert run_vals[0] == 100
        assert all(a > b for a, b in zip(run_vals, run_vals[1:])), run_vals


def test_colonnes_independantes_et_valeurs():
    out = algo.run({"density": 0.3})
    frame = np.array(out["keyframes"][10])
    assert frame.min() >= 0 and frame.max() <= 100
    assert out["rows"] == len(frame) and out["cols"] == frame.shape[1]
    lit = (np.array(out["keyframes"]) > 0).any(axis=(0, 1))
    assert lit.sum() > 0.4 * out["cols"], "beaucoup de colonnes doivent avoir une goutte"


def test_densite():
    few = np.array(algo.run({"density": 0.05, "seed": 5})["keyframes"]) > 0
    many = np.array(algo.run({"density": 0.6, "seed": 5})["keyframes"]) > 0
    assert many.mean() > few.mean()


if __name__ == "__main__":
    run_tests(globals())
