"""Tests de nqueens_backtracking. Lancer : python tests/test_nqueens_backtracking.py"""
import numpy as np
from _harness import load, check_standard, run_tests

algo = load("nqueens_backtracking")
KNOWN = {4: 2, 5: 10, 6: 4, 7: 40, 8: 92, 9: 352, 10: 724, 11: 2680, 12: 14200}


def attacks(a, b):
    return a[0] == b[0] or a[1] == b[1] or abs(a[0] - b[0]) == abs(a[1] - b[1])


def test_standard():
    check_standard(algo, "frames")


def test_nombre_de_solutions_connu():
    for n, expected in KNOWN.items():
        assert algo.count_solutions(n) == expected, n
        if n <= 8:
            assert algo.search(n, find_all=True)[1] == expected, n
        mode = algo.run({"n": n, "mode": "toutes"})
        assert mode["solutions"] == expected
    assert algo.run({"n": 8})["solutions"] == 1  # mode "première solution"


def test_premiere_solution_valide():
    for n in range(4, 13):
        first = algo.search(n)[2]
        queens = list(enumerate(first))
        assert len(queens) == n
        assert not any(attacks(a, b) for i, a in enumerate(queens) for b in queens[i + 1:])
    assert algo.search(8)[2] == (0, 4, 7, 5, 2, 6, 1, 3)


def test_chaque_frame_est_coherente():
    out = algo.run({"n": 8, "max_frames": 300})
    assert len(out["frames"]) <= 300
    for f in out["frames"]:
        g = np.array(f)
        queens = [tuple(x) for x in np.argwhere(g == 1)]
        assert not any(attacks(a, b) for i, a in enumerate(queens) for b in queens[i + 1:]), "reines compatibles"
        for cell in np.argwhere(g == 2):
            assert any(attacks(tuple(cell), q) for q in queens), "un essai refusé est bien attaqué"
    last = np.array(out["frames"][-1])
    assert (last == 1).sum() == 8 and (last == 2).sum() == 0


def test_max_frames_et_budget_en_mode_toutes():
    out = algo.run({"n": 12, "mode": "toutes", "max_frames": 30})
    assert len(out["frames"]) <= 30 and out["solutions"] == 14200


if __name__ == "__main__":
    run_tests(globals())
