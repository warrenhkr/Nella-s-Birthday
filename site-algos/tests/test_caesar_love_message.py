"""Tests de caesar_love_message. Lancer : python tests/test_caesar_love_message.py"""
from _harness import load, check_standard, run_tests

algo = load("caesar_love_message")


def test_standard():
    check_standard(algo, "text")


def test_aller_retour():
    for m in ("JOYEUX ANNIVERSAIRE", "Bonjour, le Monde ! 2026", "zZ aA"):
        for s in (1, 7, 13, 25):
            assert algo.dechiffrer(algo.chiffrer(m, s), s) == algo.normalize(m)


def test_valeurs_connues():
    assert algo.chiffrer("ABC xyz", 3) == "DEF abc"
    assert algo.chiffrer("Z", 1) == "A"


def test_ponctuation_et_casse():
    assert algo.chiffrer("Salut, ça va ?", 5) == "Xfqzy, hf af ?"


def test_accents_normalises():
    assert algo.normalize("Élève à Noël") == "Eleve a Noel"
    assert algo.dechiffrer(algo.chiffrer("Été", 4), 4) == "Ete"


def test_modes():
    clair = algo.run({"message": "BONJOUR", "shift": 3, "mode": "chiffrer"})["lines"]
    assert any("ERQMRXU" in l for l in clair)
    anim = algo.run({"message": "BONJOUR", "shift": 3, "mode": "animation"})["lines"]
    assert anim[-1].endswith("BONJOUR")
    deja = algo.run({"message": "ERQMRXU", "shift": 3, "mode": "déchiffrer"})["lines"]
    assert deja[-1].endswith("BONJOUR")


def test_erreurs():
    for bad in ({"color": "rouge"}, {"mode": "autre"}, {"message": ""}):
        try:
            algo.run(bad)
        except ValueError:
            continue
        raise AssertionError("ValueError attendue pour %r" % bad)


if __name__ == "__main__":
    run_tests(globals())
