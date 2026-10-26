"""Tests de flood_fill_paint. Lancer : python tests/test_flood_fill_paint.py"""
from collections import deque
import numpy as np
from _harness import load, check_standard, run_tests

algo = load("flood_fill_paint")


def component(grid, start):
    """Composante connexe de référence (BFS écrit indépendamment)."""
    h, w = grid.shape
    seen = {start}
    q = deque([start])
    while q:
        r, c = q.popleft()
        for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = (r + dr, c + dc)
            if 0 <= n[0] < h and 0 <= n[1] < w and grid[n] == 2 and n not in seen:
                seen.add(n)
                q.append(n)
    return seen


def distances(grid, start):
    h, w = grid.shape
    dist = {start: 0}
    q = deque([start])
    while q:
        r, c = q.popleft()
        for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = (r + dr, c + dc)
            if 0 <= n[0] < h and 0 <= n[1] < w and grid[n] == 2 and n not in dist:
                dist[n] = dist[(r, c)] + 1
                q.append(n)
    return dist


def test_standard():
    check_standard(algo, "frames")


def test_region_exacte_pour_les_deux_algos():
    for alg in ("bfs", "dfs"):
        for walls in (0.0, 0.1, 0.3):
            p = algo.read_params({"algorithm": alg, "walls": walls, "grid_size": 40}, algo.PARAMS)
            base, start = algo.make_grid(p)
            order = algo.fill_order(base, start, alg)
            assert set(order) == component(base, start), (alg, walls)
            assert len(order) == len(set(order)), "chaque case visitée une seule fois"


def test_ne_franchit_jamais_un_mur_ni_le_contour():
    p = algo.read_params({"walls": 0.3, "grid_size": 50}, algo.PARAMS)
    base, start = algo.make_grid(p)
    for r, c in algo.fill_order(base, start, "bfs"):
        assert base[r, c] == 2


def test_bfs_ordre_des_distances_croissant():
    p = algo.read_params({"walls": 0.1, "grid_size": 40}, algo.PARAMS)
    base, start = algo.make_grid(p)
    dist = distances(base, start)
    order = algo.fill_order(base, start, "bfs")
    d = [dist[c] for c in order]
    assert d == sorted(d), "onde : la distance ne fait que croître"


def test_dfs_est_un_ruban():
    p = algo.read_params({"walls": 0.0, "grid_size": 40, "algorithm": "dfs"}, algo.PARAMS)
    base, start = algo.make_grid(p)
    order = algo.fill_order(base, start, "dfs")
    adj = sum(abs(a[0] - b[0]) + abs(a[1] - b[1]) == 1 for a, b in zip(order, order[1:]))
    assert adj / (len(order) - 1) > 0.8, "le DFS enchaîne surtout des cases voisines"


def test_frames_finale_toute_peinte():
    out = algo.run({"grid_size": 30})
    last = np.array(out["frames"][-1])
    assert (last == 4).sum() == 0, "plus de front dans l'image finale"
    assert (last == 3).sum() == out["filled"]
    sans_murs = np.array(algo.run({"grid_size": 30, "walls": 0.0})["frames"][-1])
    assert (sans_murs == 2).sum() == 0, "sans murs, tout l'intérieur est peint"
    assert (np.array(out["frames"][0]) == 3).sum() == 0


if __name__ == "__main__":
    run_tests(globals())
