#!/usr/bin/env bash
# Public depoya (publicrepo → main) yeni sürüm verir.
# `main`'in o anki ağacından tek commit'lik `public` dalını yeniden üretir ve gönderir.
# Kullanım: scripts/publish-public.sh "Sürüm mesajı"
set -euo pipefail
msg="${1:-Secret Table — public release $(date +%Y-%m-%d)}"
cd "$(git rev-parse --show-toplevel)"
[ "$(git branch --show-current)" = "main" ] || { echo "önce main dalına geç"; exit 1; }
[ -z "$(git status --porcelain)" ] || { echo "çalışma ağacı temiz değil; önce commit at"; exit 1; }
git remote get-url publicrepo >/dev/null 2>&1 || { echo "publicrepo remote'u yok"; exit 1; }
git branch -D public >/dev/null 2>&1 || true
git checkout -q --orphan public
git add -A
git commit -q -m "$msg"
git checkout -q main
echo "public dalı: $(git log --oneline -1 public)"
git push publicrepo public:main --force
echo "gönderildi → $(git remote get-url publicrepo)"
