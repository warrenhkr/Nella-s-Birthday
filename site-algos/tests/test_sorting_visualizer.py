"""Tests de sorting_visualizer. Lancer : python tests/test_sorting_visualizer.py"""
import numpy as np
from _harness import load, check_standard, run_tests

algo = load("sorting_visualizer")
ALGOS = ["bubble", "insertion", "selection", "quick", "merge"]


def decode(frame):
    """Hauteur de chaque barre = nombre de cases non vides dans la colonne."""
    return (np.array(frame) > 0).sum(axis=0).tolist()


def test_standard():
    check_standard(algo, "frames")


def test_tableau_final_trie_et_etapes_valides():
    rng = np.random.default_rng(0)
    for name in ALGOS:
        for n in (8, 17, 60):
            values = (rng.permutation(n) + 1).tolist()
            steps, final = algo.record_steps(values, name)
            assert final == sorted(values), name
            for arr, _ in steps:
                assert sorted(arr) == sorted(values), "chaque étape est une permutation (%s)" % name


def test_frames_decodables_permutations():
    for name in ALGOS:
        out = algo.run({"algorithm": name, "count": 30})
        for frame in out["frames"]:
            assert sorted(decode(frame)) == list(range(1, 31)), name
        assert decode(out["frames"][-1]) == list(range(1, 31)), "dernière image triée"
        assert np.array_equal(np.array(out["frames"][-1]) > 0, np.array(out["frames"][-1]) == 3)


def test_max_frames_respecte_et_sous_echantillonnage():
    out = algo.run({"algorithm": "bubble", "count": 40, "max_frames": 30})
    assert len(out["frames"]) <= 30 and out["sampled"] is True
    full = algo.run({"algorithm": "quick", "count": 8, "max_frames": 600})
    assert len(full["frames"]) == full["steps_total"] and full["sampled"] is False


def test_premiere_image_non_triee_et_comparaisons_en_surbrillance():
    out = algo.run({"algorithm": "insertion", "count": 20, "max_frames": 600})
    assert decode(out["frames"][0]) != list(range(1, 21))
    assert any((np.array(f) == 2).any() for f in out["frames"][1:-1])


def test_nombre_d_images_borne_par_le_budget():
    out = algo.run({"count": 120, "max_frames": 600})
    assert len(out["frames"]) * 120 * 120 <= algo.MAX_CELLS


if __name__ == "__main__":
    run_tests(globals())
