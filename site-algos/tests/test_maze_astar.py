"""Tests de maze_astar. Lancer : python tests/test_maze_astar.py"""
from collections import deque
import numpy as np
from _harness import load, check_standard, run_tests

algo = load("maze_astar")


def reference_shortest(grid):
    d = grid.shape[0]
    start, goal = (1, 1), (d - 2, d - 2)
    dist = {start: 0}
    q = deque([start])
    while q:
        r, c = q.popleft()
        for dr, dc in algo.DIRS:
            n = (r + dr, c + dc)
            if grid[n] == 0 and n not in dist:
                dist[n] = dist[(r, c)] + 1
                q.append(n)
    return dist[goal], dist


def test_standard():
    check_standard(algo, "frames")


def test_labyrinthe_parfait():
    for size, seed in ((8, 1), (25, 2), (40, 3)):
        g = algo.make_maze(size, seed)
        d = 2 * size + 1
        open_cells = int((g == 0).sum())
        assert open_cells == 2 * size * size - 1
        pairs = int(((g[:-1, :] == 0) & (g[1:, :] == 0)).sum() + ((g[:, :-1] == 0) & (g[:, 1:] == 0)).sum())
        assert pairs == open_cells - 1, "arbre : n sommets, n - 1 liaisons"
        _, dist = reference_shortest(g)
        assert len(dist) == open_cells, "tout est connecté"
        assert (g[0, :] == 1).all() and (g[-1, :] == 1).all() and (g[:, 0] == 1).all() and (g[:, -1] == 1).all()


def test_chemin_le_plus_court_et_valide():
    for seed in (1, 2, 3):
        g = algo.make_maze(20, seed)
        best, _ = reference_shortest(g)
        for alg in ("bfs", "dijkstra", "astar"):
            for h in ("manhattan", "euclidienne"):
                explored, path = algo.solve(g, alg, h)
                assert len(path) - 1 == best, (alg, h)
                assert path[0] == (1, 1) and path[-1] == (g.shape[0] - 2,) * 2
                assert all(g[c] == 0 for c in path)
                assert all(abs(a[0] - b[0]) + abs(a[1] - b[1]) == 1 for a, b in zip(path, path[1:]))
                assert len(explored) == len(set(explored)), "chaque case explorée une fois"


def test_astar_explore_au_plus_autant_que_bfs():
    for seed in range(1, 8):
        g = algo.make_maze(25, seed)
        bfs = len(algo.solve(g, "bfs")[0])
        for h in ("manhattan", "euclidienne"):
            assert len(algo.solve(g, "astar", h)[0]) <= bfs, (seed, h)


def test_frames():
    out = algo.run({"size": 12, "max_frames": 40})
    assert len(out["frames"]) <= 40
    first, last = np.array(out["frames"][0]), np.array(out["frames"][-1])
    assert (first == 2).sum() == 0 and (first == 3).sum() == 0
    assert (last == 3).sum() == out["path_length"] - 1, "chemin final peint (départ et arrivée exclus)"
    assert first[1, 1] == 4 and first[-2, -2] == 5
    counts = [(np.array(f) == 2).sum() for f in out["frames"][:-1]]  # la dernière image recouvre le chemin
    assert counts == sorted(counts), "les cases explorées s'accumulent"


if __name__ == "__main__":
    run_tests(globals())
