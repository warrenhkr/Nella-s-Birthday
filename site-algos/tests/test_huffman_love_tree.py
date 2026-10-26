"""Tests de huffman_love_tree. Lancer : python tests/test_huffman_love_tree.py"""
import math
from collections import Counter
from _harness import load, check_standard, run_tests

algo = load("huffman_love_tree")
MESSAGES = ["JOYEUX ANNIVERSAIRE", "aaaaaaaa", "abcabcabc d", "à la bonne heure ♥", "x", "mississippi river"]


def test_standard():
    check_standard(algo, "text")


def test_decodage_redonne_le_message():
    for m in MESSAGES:
        out = algo.run({"message": m})
        assert algo.decode(out["bits"], out["codes"]) == m, m


def test_aucun_code_n_est_prefixe_d_un_autre():
    for m in MESSAGES:
        codes = list(algo.run({"message": m})["codes"].values())
        for i, a in enumerate(codes):
            for j, b in enumerate(codes):
                assert i == j or not b.startswith(a), (m, a, b)


def test_optimalite_et_inegalite_de_kraft():
    for m in MESSAGES[:3] + MESSAGES[5:]:
        codes = algo.run({"message": m})["codes"]
        if len(codes) > 1:
            assert abs(sum(2.0 ** -len(c) for c in codes.values()) - 1.0) < 1e-12, "arbre complet"
        freq = Counter(m)
        by_len = sorted(codes, key=lambda s: len(codes[s]))
        for a in codes:
            for b in codes:
                if freq[a] > freq[b]:
                    assert len(codes[a]) <= len(codes[b]), "plus fréquent = code plus court"
        # borne de Shannon : la longueur moyenne est dans [H, H + 1[
        n = len(m)
        entropy = -sum(f / n * math.log2(f / n) for f in freq.values())
        avg = sum(freq[s] * len(codes[s]) for s in freq) / n
        assert entropy - 1e-9 <= avg < entropy + 1 + 1e-9 or len(codes) == 1


def test_deterministe_malgre_les_egalites():
    for _ in range(5):
        assert algo.run({"message": "abcd efgh"}) == algo.run({"message": "abcd efgh"})
    assert algo.run({"message": "abcd"})["codes"] == algo.run({"message": "abcd"})["codes"]


def test_taux_de_compression():
    out = algo.run({"message": "aaaaaaaaaaaaaaaaaaaa"})
    assert out["bits"] == "0" * 20 and abs(out["ratio"] - 20 / 160) < 1e-12
    out = algo.run({"message": "JOYEUX ANNIVERSAIRE"})
    assert out["ratio"] < 1.0 and len(out["bits"]) == round(out["ratio"] * 8 * 19)
    assert any(l.startswith("Taux") for l in out["lines"])


def test_options_d_affichage():
    full = algo.run({"message": "banane", "show_steps": True, "show_tree": True})["lines"]
    plain = algo.run({"message": "banane", "show_steps": False, "show_tree": False})["lines"]
    assert len(full) > len(plain)
    assert any("Fusions" in l for l in full) and not any("Fusions" in l for l in plain)
    assert any("Arbre" in l for l in full) and not any("Arbre" in l for l in plain)


if __name__ == "__main__":
    run_tests(globals())
