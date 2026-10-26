#!/usr/bin/env bash
# scripts/qa-visual-run.sh
#
# Lance la QA visuelle par LOTS de pages (reprise possible, rien n'est perdu si
# un lot échoue : chaque lot réécrit seulement ses propres captures et sonde).
#
# Usage : bash scripts/qa-visual-run.sh [editeur|matrix|both] [tentatives]
set -u
cd "$(dirname "$0")/.." || exit 1
LOG_DIR="C:/Users/dosso/AppData/Local/Temp"
MODE="${1:-both}"
ESSAIS="${2:-2}"

LOTS=(
  "public:accueil,communaute,galerie,boutique,auth,inscription"
  "membre:evenements,espace-membre,tournois,equipes"
  "admin:dashboard,dashboard-evenementiel,dashboard-moderation,dashboard-gaming"
  "boutique:boutique-catalogue,boutique-dashboard"
)

if [ "$MODE" = "editeur" ] || [ "$MODE" = "both" ]; then
  echo "[$(date +%H:%M:%S)] sonde éditeur riche…"
  QA_MODE=editeur QA_ROLE=ADMIN node scripts/qa-visual-mesures.mjs > "$LOG_DIR/qa-editeur.log" 2>&1
  echo "[$(date +%H:%M:%S)] sonde éditeur terminée (code $?)"
fi

if [ "$MODE" = "matrix" ] || [ "$MODE" = "both" ]; then
  for lot in "${LOTS[@]}"; do
    nom="${lot%%:*}"
    pages="${lot#*:}"
    for essai in $(seq 1 "$ESSAIS"); do
      echo "[$(date +%H:%M:%S)] matrice — lot $nom (essai $essai/$ESSAIS) : $pages"
      QA_MODE=matrix QA_ONLY="$pages" QA_RESUME=1 node scripts/qa-visual-mesures.mjs > "$LOG_DIR/qa-matrix-$nom.log" 2>&1
      code=$?
      echo "[$(date +%H:%M:%S)] lot $nom terminé (code $code)"
      [ "$code" = "0" ] && break
      sleep 5
    done
  done
fi
echo "[$(date +%H:%M:%S)] FIN"
