"""Tests des 12 algos analyste. Lancer : python tests/analyste-algos/test_analyste_algos.py"""
import math
import random
import numpy as np
from _harness import load, check_standard, run_tests, defaults

ma, pa, be, rg, km = (load(n) for n in ("moving_average_forecast", "pareto_chart", "break_even_chart", "regression_scatter", "kmeans_customers"))
mc, ab, eq, fu, co, wf, dc = (load(n) for n in ("monte_carlo_budget", "ab_test_significance", "eoq_inventory", "funnel_conversion", "cohort_retention_heatmap", "waterfall_profit", "data_cleaning_report"))


# ------------------------------------------------------------------ conformité standard
def test_standard_tous_les_algos():
    for mod, typ in ((ma, "image"), (pa, "image"), (be, "image"), (rg, "image"), (km, "points"), (mc, "image"),
                     (ab, "text"), (eq, "image"), (fu, "image"), (co, "grid"), (wf, "image"), (dc, "text")):
        check_standard(mod, typ, seed_changes="seed" in [s["name"] for s in mod.PARAMS])


# ------------------------------------------------------------------ prévision
def test_moyenne_mobile_valeurs_connues():
    assert ma.moving_average(np.array([1.0, 2, 3, 4, 5]), 3) == [None, None, 2.0, 3.0, 4.0]


def test_prevision_retrouve_la_tendance_sans_bruit():
    out = ma.run({"trend": 4.0, "seasonality": 0.0, "noise": 0.0, "months": 24, "horizon": 6})
    assert abs(out["summary"]["slope"] - 4.0) < 1e-3
    assert len(out["summary"]["forecast"]) == 6
    f = out["summary"]["forecast"]
    assert all(abs((b - a) - 4.0) < 0.2 for a, b in zip(f, f[1:])), "la prévision prolonge la droite"


def test_regression_lineaire_exacte():
    t = np.arange(10, dtype=float)
    slope, intercept = ma.linear_fit(t, 3 * t + 7)
    assert abs(slope - 3) < 1e-12 and abs(intercept - 7) < 1e-12


# ------------------------------------------------------------------ Pareto
def test_pareto_comptes_et_causes_vitales():
    for causes in (4, 8, 12):
        for skew in (0.5, 1.5, 3.0):
            for threshold in (50, 80, 95):
                out = pa.run({"causes": causes, "skew": skew, "threshold": threshold, "total": 1234})
                s = out["summary"]
                assert sum(s["counts"]) == 1234
                assert s["counts"] == sorted(s["counts"], reverse=True)
                assert abs(s["cumul_pct"][-1] - 100) < 0.11
                k = s["vital_few"]
                assert s["cumul_pct"][k - 1] >= threshold - 0.06
                assert k == 1 or s["cumul_pct"][k - 2] < threshold + 0.06, "k est minimal"


def test_pareto_plus_inegal_moins_de_causes_vitales():
    low = pa.run({"skew": 0.5, "causes": 10})["summary"]["vital_few"]
    high = pa.run({"skew": 3.0, "causes": 10})["summary"]["vital_few"]
    assert high < low


# ------------------------------------------------------------------ seuil de rentabilité
def test_seuil_de_rentabilite_est_le_plus_petit_entier_rentable():
    rnd = random.Random(1)
    for _ in range(300):
        fixed, price = rnd.uniform(500, 50000), rnd.uniform(5, 500)
        vc = rnd.uniform(1, price - 0.5)
        q = be.break_even_units(fixed, price, vc)
        assert be.profit(q, fixed, price, vc) >= -1e-6
        assert q == 0 or be.profit(q - 1, fixed, price, vc) < 0


def test_seuil_exemple_chiffre():
    out = be.run({"fixed_costs": 12000, "price": 40, "unit_cost": 22})
    assert out["summary"]["break_even_units"] == 667  # 12000 / 18 = 666,67 -> 667
    assert out["summary"]["margin_per_unit"] == 18 and out["summary"]["margin_rate_pct"] == 45.0


def test_seuil_prix_inferieur_au_cout_refuse():
    for kw in ({"price": 10, "unit_cost": 10}, {"price": 10, "unit_cost": 20}):
        try:
            be.run(kw)
        except ValueError:
            continue
        raise AssertionError("ValueError attendue pour %r" % kw)


# ------------------------------------------------------------------ régression
def test_regression_sans_bruit_est_exacte():
    s = rg.run({"noise": 0.0, "slope": 2.5, "intercept": -4.0, "outliers": 0})["summary"]
    assert abs(s["slope"] - 2.5) < 1e-3 and abs(s["intercept"] + 4.0) < 1e-2 and s["r2"] > 0.9999


def test_regression_calcul_sur_points_connus():
    x = np.array([1.0, 2, 3, 4, 5])
    y = np.array([2.0, 4, 5, 4, 5])
    slope, intercept, r, r2 = rg.fit(x, y)
    assert abs(slope - 0.6) < 1e-12 and abs(intercept - 2.2) < 1e-12
    assert abs(r - 0.7745966692) < 1e-9 and abs(r2 - 0.6) < 1e-12


def test_valeurs_aberrantes_degradent_r2():
    clean = rg.run({"outliers": 0, "noise": 5})["summary"]["r2"]
    dirty = rg.run({"outliers": 10, "noise": 5})["summary"]["r2"]
    assert dirty < clean and 0 <= dirty <= 1


# ------------------------------------------------------------------ K-means
def test_kmeans_inertie_decroit_et_tout_le_monde_est_affecte():
    for seed in (1, 2, 3, 4):
        out = km.run({"seed": seed, "clusters": 4, "iterations": 30})
        h = out["inertia"]
        assert all(b <= a + 1e-9 for a, b in zip(h, h[1:])), "l'inertie ne peut que diminuer"
        assert sum(out["clusters"]) == 240 and all(c > 0 for c in out["clusters"])
        assert len(out["points"]) == 240 + 4, "clients + un point par centre"
        assert len({tuple(p["color"] for p in out["points"][:240])}) == 1


def test_kmeans_plus_de_segments_moins_d_inertie():
    one = km.run({"clusters": 2, "iterations": 40})["inertia"][-1]
    many = km.run({"clusters": 6, "iterations": 40})["inertia"][-1]
    assert many < one


# ------------------------------------------------------------------ Monte-Carlo
def test_monte_carlo_moyenne_et_percentiles():
    s = mc.run({"simulations": 20000})["summary"]
    assert abs(s["mean"] - s["expected"]) / s["expected"] < 0.01, "la moyenne simulée est proche de l'espérance théorique"
    assert s["min"] <= s["p50"] <= s["budget"] <= s["max"]
    assert s["sum_of_modes"] < s["mean"], "les lois sont asymétriques à droite : la somme des probables est optimiste"
    b50 = mc.run({"confidence": 50, "simulations": 5000})["summary"]["budget"]
    b99 = mc.run({"confidence": 99, "simulations": 5000})["summary"]["budget"]
    assert b99 > b50


# ------------------------------------------------------------------ test A/B
def test_ab_z_connu():
    z, p, diff, ci = ab.two_proportion_test(10000, 1000, 10000, 1100)
    pooled = 2100 / 20000
    expected = 0.01 / math.sqrt(pooled * (1 - pooled) * 2 / 10000)
    assert abs(z - expected) < 1e-12 and abs(z - 2.3) < 0.2
    assert abs(p - (1 - math.erf(abs(z) / math.sqrt(2)))) < 1e-12
    assert ci[0] < diff < ci[1]


def test_ab_symetrie_et_egalite():
    z1, p1, *_ = ab.two_proportion_test(5000, 500, 5000, 600)
    z2, p2, *_ = ab.two_proportion_test(5000, 600, 5000, 500)
    assert abs(z1 + z2) < 1e-12 and abs(p1 - p2) < 1e-12
    z, p, diff, _ = ab.two_proportion_test(3000, 300, 3000, 300)
    assert z == 0 and abs(p - 1) < 1e-12 and diff == 0


def test_ab_verdict():
    assert ab.run({"rate_a": 10, "rate_b": 10})["summary"]["significant"] is False
    assert ab.run({"rate_a": 10, "rate_b": 14, "visitors_a": 20000, "visitors_b": 20000})["summary"]["significant"] is True
    assert ab.run({"visitors_a": 100, "visitors_b": 100, "rate_a": 10, "rate_b": 12})["summary"]["significant"] is False, "peu de visiteurs : pas concluant"


# ------------------------------------------------------------------ EOQ
def test_eoq_formule_et_minimum():
    for d, s, h in ((12000, 80, 2.4), (500, 20, 0.5), (90000, 900, 80)):
        q = eq.eoq(d, s, h)
        assert abs(q - math.sqrt(2 * d * s / h)) < 1e-9
        c = eq.total_cost(q, d, s, h)
        for factor in (0.3, 0.7, 0.9, 1.1, 1.5, 2.4):
            assert eq.total_cost(q * factor, d, s, h) > c
        assert abs(d / q * s - q / 2 * h) < 1e-6, "au minimum, frais de commande = frais de stockage"
    out = eq.run({})["summary"]
    assert abs(out["ordering_cost_at_eoq"] - out["holding_cost_at_eoq"]) < 0.01


# ------------------------------------------------------------------ entonnoir
def test_entonnoir_coherent():
    for seed in range(1, 15):
        s = fu.run({"seed": seed, "steps": 5})["summary"]
        c = s["counts"]
        assert all(b < a for a, b in zip(c, c[1:])), "chaque étape perd du monde"
        rates = s["step_rates_pct"]
        assert all(abs(r - 100 * c[i + 1] / c[i]) < 0.01 for i, r in enumerate(rates))
        assert s["worst_transition"] == rates.index(min(rates))
        assert abs(s["overall_pct"] - 100 * c[-1] / c[0]) < 0.001


# ------------------------------------------------------------------ cohortes
def test_cohortes_triangle_et_retention_decroissante():
    for cohorts, periods in ((8, 8), (12, 6), (5, 12)):
        out = co.run({"cohorts": cohorts, "periods": periods})
        cells, mask = out["cells"], out["mask"]
        for i in range(cohorts):
            observed = [j for j in range(periods) if mask[i][j]]
            assert observed == list(range(max(0, periods - i))), "triangle d'observation"
            assert all(0 <= cells[i][j] <= 100 for j in range(periods))
            row = [cells[i][j] for j in observed]
            assert not row or row[0] == 100
            assert all(b <= a for a, b in zip(row, row[1:])), "la rétention ne remonte jamais"
            assert all(cells[i][j] == 0 for j in range(periods) if not mask[i][j])
    assert out["average_by_period"][0] == 100.0


# ------------------------------------------------------------------ cascade
def test_cascade_comptabilite():
    for kw in ({}, {"cogs_pct": 80, "marketing_pct": 30, "salaries_pct": 40, "other_pct": 20}, {"tax_rate": 0}):
        s = wf.run(kw)["summary"]
        assert abs(s["gross"] - (s["revenue"] - s["cogs"])) < 0.02
        assert abs(s["ebt"] - (s["gross"] - s["marketing"] - s["salaries"] - s["other"])) < 0.02
        assert abs(s["net"] - (s["ebt"] - s["tax"])) < 0.02
        assert s["tax"] >= 0 and (s["ebt"] >= 0 or s["tax"] == 0), "pas d'impôt sur une perte"
    base = wf.run({})["summary"]
    assert base["net"] == 22500.0 and base["net_margin_pct"] == 11.25


# ------------------------------------------------------------------ nettoyage
def test_nettoyage_retrouve_les_defauts_injectes():
    for seed in range(1, 8):
        out = dc.run({"seed": seed, "rows": 200, "duplicate_rate": 6, "missing_rate": 10, "outlier_rate": 4})
        s = out["summary"]
        inj = s["injected"]
        assert s["duplicates_found"] == inj["duplicates"]
        assert s["rows"] == 200 + inj["duplicates"]
        assert s["kept"] <= s["rows"] - s["duplicates_found"]
        assert s["mean_after"] < s["mean_before"], "retirer les aberrants fait baisser la moyenne"
    none = dc.run({"duplicate_rate": 0, "missing_rate": 0, "outlier_rate": 0})["summary"]
    assert none["duplicates_found"] == 0 and none["missing_found"] == 0 and none["injected"]["duplicates"] == 0


def test_nettoyage_aberrants_injectes_sont_detectes():
    out = dc.run({"seed": 3, "rows": 300, "duplicate_rate": 0, "missing_rate": 0, "outlier_rate": 5})["summary"]
    injected_ids = {i + 1 for i in out["injected"]["outliers"]}
    assert injected_ids.issubset(set(out["outliers_found"]))


if __name__ == "__main__":
    run_tests(globals())
