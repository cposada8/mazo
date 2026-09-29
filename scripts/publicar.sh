#!/usr/bin/env bash
#
# Take dev to production, and move the version while doing it.
#
#   npm run publicar            # 1.2.0 -> 1.3.0  (the usual release)
#   npm run publicar -- patch   # 1.2.0 -> 1.2.1  (a small fix)
#   npm run publicar -- major   # 1.2.0 -> 2.0.0
#   npm run publicar -- 1.0.0   # an exact number
#
# The version in package.json moves here and nowhere else: it counts what
# went to production, not what went to dev (lib/version.ts). So the steps are
# always the same — checks on dev, merge into main, bump, tag, push — and dev
# is brought up to main afterwards so it knows the number it is building on.

set -euo pipefail

SUBIDA="${1:-minor}"

cd "$(dirname "$0")/.."

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Hay cambios sin commit. Publica desde un árbol limpio." >&2
  exit 1
fi

git fetch --quiet origin
git checkout --quiet dev
git merge --quiet --ff-only origin/dev

if [[ -z "$(git log --oneline origin/main..dev)" ]]; then
  echo "dev no tiene nada que main no tenga ya. Nada que publicar." >&2
  exit 1
fi

echo "→ Verificando dev: tests, lint y build"
npm run --silent test:run
npm run --silent lint
npm run --silent build > /dev/null

ANTERIOR="$(node -p "require('./package.json').version")"
PENDIENTE="$(git log --format='- %s' origin/main..dev --no-merges)"

git checkout --quiet main
git merge --quiet --ff-only origin/main
git merge --quiet --no-ff dev -m "Merge dev into main for release" \
  -m "$PENDIENTE"

npm version "$SUBIDA" --no-git-tag-version > /dev/null
VERSION="$(node -p "require('./package.json').version")"

git commit --quiet --amend -a -m "v${VERSION} goes to production (from v${ANTERIOR})" \
  -m "$PENDIENTE"
git tag -a "v${VERSION}" -m "v${VERSION}"
git push --quiet origin main "v${VERSION}"

# dev learns the number it now builds on.
git checkout --quiet dev
git merge --quiet --ff-only main
git push --quiet origin dev

echo "✓ v${VERSION} va para producción (antes v${ANTERIOR})."
