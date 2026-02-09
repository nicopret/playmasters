REPO="nicopret/playmasters"

# Core
gh label create "space-blaster" --repo "$REPO" --color "1D76DB" --force
gh label create "type:epic"      --repo "$REPO" --color "5319E7" --force
gh label create "type:story"     --repo "$REPO" --color "0E8A16" --force

# Phases
gh label create "phase:1" --repo "$REPO" --color "BFDADC" --force
gh label create "phase:2" --repo "$REPO" --color "BFDADC" --force
gh label create "phase:3" --repo "$REPO" --color "BFDADC" --force
gh label create "phase:4" --repo "$REPO" --color "BFDADC" --force

# Workstreams
gh label create "ws:admin"        --repo "$REPO" --color "FBCA04" --force
gh label create "ws:config"       --repo "$REPO" --color "FBCA04" --force
gh label create "ws:runtime"      --repo "$REPO" --color "FBCA04" --force
gh label create "ws:scoring"      --repo "$REPO" --color "FBCA04" --force
gh label create "ws:presentation" --repo "$REPO" --color "FBCA04" --force
gh label create "ws:qa"           --repo "$REPO" --color "FBCA04" --force
