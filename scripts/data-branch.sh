#!/usr/bin/env bash
# Generated data lives on the `data` branch, not on main.
#
# main holds code and the hand-edited files (data/taxonomy.yml, data/tools.yml). The jobs' output
# (thousands of JSON files rewritten every 6 hours) goes to its own branch so main's history is
# only commits people made. The site bundle in frontend/public/data is not stored anywhere: the
# deploy rebuilds it from both.
#
#   scripts/data-branch.sh pull              put the data branch's files into data/
#   scripts/data-branch.sh push "<message>"  commit data/'s generated files onto the data branch
#
# `push` commits on top of the tip that `pull` fetched, without fetching again. If another job
# pushed in between, the push is rejected instead of silently overwriting that job's work with an
# older snapshot. The data workflows also share one concurrency group so this should not happen.
set -euo pipefail

BRANCH=data
PATHS=(
  data/hackathons
  data/ideas
  data/labels
  data/winners
  data/source_runs.json
  data/source_health.json
)

cd "$(git rev-parse --show-toplevel)"

case "${1:-}" in
  pull)
    # Shallow: only the latest snapshot is needed, and the branch's history grows every 6 hours.
    git fetch --quiet --depth 1 origin "+refs/heads/$BRANCH:refs/remotes/origin/$BRANCH"
    # Clear first, so files the branch has since deleted do not linger.
    rm -rf "${PATHS[@]}"
    git archive "origin/$BRANCH" | tar -x
    echo "Pulled $(git ls-tree -r --name-only "origin/$BRANCH" | wc -l | tr -d ' ') files from $BRANCH."
    ;;

  push)
    message="${2:?usage: $0 push <message>}"
    parent=$(git rev-parse --verify --quiet "refs/remotes/origin/$BRANCH" || true)

    # Build the commit in a throwaway index, so main's checkout and index are never touched.
    GIT_INDEX_FILE="$(mktemp -d)/index"
    export GIT_INDEX_FILE
    existing=()
    for path in "${PATHS[@]}"; do [[ -e $path ]] && existing+=("$path"); done
    git add --force -- "${existing[@]}"
    tree=$(git write-tree)

    if [[ -n $parent && $tree == "$(git rev-parse "$parent^{tree}")" ]]; then
      echo "No changes to push."
      exit 0
    fi

    # "Update hackathon data (4 added, 12 changed)" says more than the same title every time.
    if [[ -n $parent ]]; then
      summary=$(git diff --name-status "$parent" "$tree" | cut -c1 | sort | uniq -c |
        awk '{ word = ($2 == "A" ? "added" : $2 == "D" ? "removed" : "changed")
               printf "%s%s %s", sep, $1, word; sep = ", " }')
      message="$message ($summary)"
    fi

    commit=$(git commit-tree "$tree" ${parent:+-p "$parent"} -m "$message")
    git push --quiet origin "$commit:refs/heads/$BRANCH"
    echo "Pushed $commit to $BRANCH: $message"
    if [[ -n ${GITHUB_OUTPUT:-} ]]; then echo "changed=true" >> "$GITHUB_OUTPUT"; fi
    ;;

  *)
    echo "usage: $0 pull | push <message>" >&2
    exit 2
    ;;
esac
