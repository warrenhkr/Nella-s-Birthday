"""Tests de love_text_console. Lancer : python tests/test_love_text_console.py"""
from _harness import load, check_standard, run_tests

algo = load("love_text_console")


def test_standard():
    check_standard(algo, "text")


def test_lignes_de_meme_longueur():
    for style in ("coeur", "boite", "simple"):
        for w in (24, 40, 60):
            out = algo.run({"style": style, "width_chars": w})
            assert all(len(line) == w for line in out["lines"]), (style, w)


def test_message_dans_la_sortie():
    out = algo.run({"message": "Bravo Nina"})
    assert any("Bravo Nina" in line for line in out["lines"])


def test_erreurs():
    for bad in ({"message": ""}, {"message": "x" * 41}, {"color": "violet"}, {"width_chars": 24, "message": "x" * 25}):
        try:
            algo.run(bad)
        except ValueError:
            continue
        raise AssertionError("ValueError attendue pour %r" % bad)


if __name__ == "__main__":
    run_tests(globals())
