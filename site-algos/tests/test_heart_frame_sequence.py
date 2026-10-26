"""Tests de heart_frame_sequence. Lancer : python tests/test_heart_frame_sequence.py"""
import base64
import io
import numpy as np
from PIL import Image
from _harness import load, check_standard, run_tests

algo = load("heart_frame_sequence")


def decode(uri):
    assert uri.startswith("data:image/png;base64,")
    return Image.open(io.BytesIO(base64.b64decode(uri.split(",", 1)[1])))


def lit_pixels(img):
    a = np.array(img.convert("RGB")).astype(int)
    bg = np.array(algo.BACKGROUND)
    return int((np.abs(a - bg).sum(axis=2) > 60).sum())


def test_standard():
    check_standard(algo, "frames", max_time=1.0)


def test_images_png_valides_de_la_bonne_taille():
    out = algo.run({"frames": 10, "size": 128})
    assert len(out["frames"]) == 10 and out["width"] == out["height"] == 128
    for uri in out["frames"]:
        img = decode(uri)
        assert img.size == (128, 128) and img.format == "PNG"


def test_easings_bornes_et_croissants():
    for name, f in algo.EASINGS.items():
        xs = np.linspace(0, 1, 1000)
        ys = [f(float(x)) for x in xs]
        assert abs(ys[0]) < 1e-12 and abs(ys[-1] - 1) < 1e-12, name
        assert all(b >= a - 1e-12 for a, b in zip(ys, ys[1:])), name


def test_boucle_parfaite():
    for easing in algo.EASINGS:
        assert abs(algo.pulse(24, 24, easing) - algo.pulse(0, 24, easing)) < 1e-9
        assert algo.pulse(0, 24, easing) < 1e-9 and abs(algo.pulse(12, 24, easing) - 1) < 1e-9


def test_le_coeur_grossit_au_milieu():
    out = algo.run({"frames": 12, "size": 128, "sparkles": 0})
    first, mid = lit_pixels(decode(out["frames"][0])), lit_pixels(decode(out["frames"][6]))
    assert mid > first * 1.2


def test_determinisme_des_octets():
    a = algo.run({"frames": 10, "size": 128, "seed": 5})
    b = algo.run({"frames": 10, "size": 128, "seed": 5})
    c = algo.run({"frames": 10, "size": 128, "seed": 6})
    assert a["frames"] == b["frames"] and a["frames"] != c["frames"]


def test_poids_raisonnable():
    out = algo.run({})
    total = sum(len(u) for u in out["frames"])
    assert total < 1_500_000, "poids total : %d octets" % total


if __name__ == "__main__":
    run_tests(globals())
