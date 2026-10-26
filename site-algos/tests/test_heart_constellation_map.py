"""Tests de heart_constellation_map. Lancer : python tests/test_heart_constellation_map.py"""
import numpy as np
from _harness import load, check_standard, run_tests

algo = load("heart_constellation_map")


def prim_weight(xy):
    """Poids de l'arbre couvrant minimal par Prim (référence indépendante de Kruskal)."""
    n = len(xy)
    d = np.hypot(*(xy[:, None, :] - xy[None, :, :]).transpose(2, 0, 1))
    in_tree = np.zeros(n, dtype=bool)
    best = np.full(n, np.inf)
    best[0] = 0.0
    total = 0.0
    for _ in range(n):
        v = int(np.argmin(np.where(in_tree, np.inf, best)))
        total += best[v]
        in_tree[v] = True
        best = np.minimum(best, d[v])
    return total


def test_standard():
    check_standard(algo, "points")


def test_kruskal_poids_minimal_comme_prim():
    rng = np.random.default_rng(3)
    for n in (5, 30, 120):
        xy = rng.uniform(0, 100, (n, 2))
        tree, _ = algo.kruskal(xy)
        weight = sum(float(np.hypot(*(xy[i] - xy[j]))) for i, j in tree)
        assert len(tree) == n - 1
        assert abs(weight - prim_weight(xy)) < 1e-9


def test_arbre_connecte_sans_cycle():
    rng = np.random.default_rng(4)
    xy = rng.uniform(0, 100, (80, 2))
    tree, _ = algo.kruskal(xy)
    uf = algo.UnionFind(80)
    assert all(uf.union(i, j) for i, j in tree), "aucun cycle"
    assert len({uf.find(i) for i in range(80)}) == 1, "un seul groupe"


def test_liens_de_la_sortie():
    out = algo.run({"count": 100, "extra_links": 0.0})
    assert len(out["links"]) == 99 and out["tree_links"] == 99
    out = algo.run({"count": 100, "extra_links": 0.2})
    assert len(out["links"]) == 99 + 20
    assert all(0 <= a < 100 and 0 <= b < 100 and a != b for a, b in out["links"])
    assert len({tuple(sorted(l)) for l in out["links"]}) == len(out["links"]), "pas de doublon"


def test_union_find():
    uf = algo.UnionFind(6)
    assert uf.union(0, 1) and uf.union(1, 2) and not uf.union(0, 2)
    assert uf.find(0) == uf.find(2) != uf.find(3)


if __name__ == "__main__":
    run_tests(globals())
