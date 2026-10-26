"""Tests de mandelbrot_julia_violet. Lancer : python tests/test_mandelbrot_julia_violet.py"""
import base64
import io
import cmath
import numpy as np
from PIL import Image
from _harness import load, check_standard, run_tests

algo = load("mandelbrot_julia_violet")


def decode(uri):
    return Image.open(io.BytesIO(base64.b64decode(uri.split(",", 1)[1])))


def mu_of(**kw):
    base = dict(kind="mandelbrot", size=129, max_iter=60, zoom=1.0, cx=0.0, cy=0.0, c_real=-0.8, c_imag=0.156)
    base.update(kw)
    return algo.escape_values(**base)


def escape_count(c, max_iter):
    z = 0
    for i in range(max_iter):
        z = z * z + c
        if abs(z) > 100:
            return i
    return max_iter


def test_standard():
    check_standard(algo, "image", max_time=1.0)


def test_symetrie_exacte_autour_de_l_axe_reel():
    for size in (128, 129, 200):
        mu = mu_of(size=size)
        assert np.array_equal(mu, mu[::-1]), size


def test_points_connus():
    mu = mu_of(size=129)
    assert mu[64, 64] == -1.0, "c = 0 reste borné"
    assert mu[0, 0] > 0 and mu[0, 128] > 0, "les coins divergent"
    mu2 = mu_of(size=129, cx=-1.0, zoom=1.0)  # l'intérieur du bulbe principal autour de -1
    assert mu2[64, 64] == -1.0


def test_coherence_avec_une_boucle_simple():
    size, max_iter = 41, 40
    mu = mu_of(size=size, max_iter=max_iter, cx=-0.5, zoom=1.5)
    span = 3.5 / 1.5
    step = span / size
    for (row, col) in ((5, 7), (20, 20), (33, 12), (10, 35), (20, 8)):
        c = complex(-0.5 + (col - (size - 1) / 2) * step, -(row - (size - 1) / 2) * step)
        inside_ref = escape_count(c, max_iter) == max_iter
        assert inside_ref == (mu[row, col] < 0), (row, col)


def test_julia_et_zoom():
    a = mu_of(kind="julia")
    b = mu_of(kind="mandelbrot")
    assert not np.array_equal(a, b)
    wide, near = mu_of(zoom=1.0), mu_of(zoom=8.0)
    assert (wide < 0).mean() != (near < 0).mean()


def test_image_png_valide():
    out = algo.run({"size": 160, "max_iter": 40})
    img = decode(out["data"])
    assert img.size == (160, 160) and img.mode == "RGB"
    arr = np.array(img)
    assert len(np.unique(arr.reshape(-1, 3), axis=0)) > 20, "plusieurs couleurs (dégradé)"
    for pal in ("violet", "rose", "nuit"):
        assert algo.run({"size": 128, "palette": pal})["data"] != algo.run({"size": 128, "palette": "violet"})["data"] or pal == "violet"


def test_vectorise_donc_rapide():
    import time
    t0 = time.perf_counter()
    algo.run({})
    assert time.perf_counter() - t0 < 1.0


if __name__ == "__main__":
    run_tests(globals())
