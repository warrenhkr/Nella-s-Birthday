"""Lance tous les tests : python run_all_tests.py"""
import glob
import os
import subprocess
import sys

here = os.path.dirname(os.path.abspath(__file__))
bad = []
for path in sorted(glob.glob(os.path.join(here, "tests", "test_*.py"))):
    r = subprocess.run([sys.executable, path], capture_output=True, text=True)
    last = r.stdout.strip().splitlines()[-1] if r.stdout.strip() else ""
    print("%-42s %s" % (os.path.basename(path), "OK  " + last if r.returncode == 0 else "ECHEC"))
    if r.returncode:
        bad.append(path)
        print(r.stdout[-800:], r.stderr[-1200:])
print("\n%d fichier(s) en échec" % len(bad) if bad else "\nTout est vert.")
sys.exit(1 if bad else 0)
