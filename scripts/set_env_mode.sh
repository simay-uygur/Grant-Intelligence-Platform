#!/usr/bin/env bash
set -euo pipefail

# Script to easily toggle environment permutations between local and deployed configurations
# for Frontend (VITE_API_MODE) and Backend Database / Session Storage (SESSION_STORAGE_TYPE).

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT_ENV="$ROOT_DIR/.env"
FRONTEND_ENV="$ROOT_DIR/frontend/.env.local"

# Default current values
FE_MODE=""
DB_MODE=""

show_usage() {
    cat << 'EOF'
Usage: ./scripts/set_env_mode.sh [OPTIONS]

Options for 4 Key Permutations:
  --both-local              Frontend: MOCK (local)    | Backend DB: LOCAL (SQLite)
  --both-deployed           Frontend: API (deployed)  | Backend DB: HOSTED (RDS / Cloud DB)
  --fe-local-db-deployed    Frontend: MOCK (local)    | Backend DB: HOSTED (RDS / Cloud DB)
  --fe-deployed-db-local    Frontend: API (deployed)  | Backend DB: LOCAL (SQLite)

Individual Toggle Options:
  --fe-local, --fe-mock     Set Frontend VITE_API_MODE=mock
  --fe-deployed, --fe-api   Set Frontend VITE_API_MODE=api
  --db-local, --db-sqlite   Set Backend SESSION_STORAGE_TYPE=local
  --db-deployed, --db-hosted Set Backend SESSION_STORAGE_TYPE=hosted

Help:
  -h, --help                Show this help message
EOF
}

# Parse Arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        --both-local)
            FE_MODE="mock"
            DB_MODE="local"
            shift
            ;;
        --both-deployed|--both-hosted)
            FE_MODE="api"
            DB_MODE="hosted"
            shift
            ;;
        --fe-local-db-deployed|--fe-mock-db-hosted)
            FE_MODE="mock"
            DB_MODE="hosted"
            shift
            ;;
        --fe-deployed-db-local|--fe-api-db-local)
            FE_MODE="api"
            DB_MODE="local"
            shift
            ;;
        --fe-local|--fe-mock)
            FE_MODE="mock"
            shift
            ;;
        --fe-deployed|--fe-api)
            FE_MODE="api"
            shift
            ;;
        --db-local|--db-sqlite)
            DB_MODE="local"
            shift
            ;;
        --db-deployed|--db-hosted|--db-rds)
            DB_MODE="hosted"
            shift
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            echo "Error: Unknown argument '$1'"
            show_usage
            exit 1
            ;;
    esac
done

if [[ -z "$FE_MODE" && -z "$DB_MODE" ]]; then
    echo "No options specified. Displaying current configuration:"
    echo "--------------------------------------------------------"
    if [[ -f "$ROOT_ENV" ]]; then
        grep -E "^(VITE_API_MODE|SESSION_STORAGE_TYPE)=" "$ROOT_ENV" || true
    fi
    echo "--------------------------------------------------------"
    show_usage
    exit 0
fi

# Function to update or append a key=value in a file
update_env_var() {
    local file="$1"
    local key="$2"
    local value="$3"

    if [[ ! -f "$file" ]]; then
        touch "$file"
    fi

    if grep -q "^${key}=" "$file"; then
        # Replace existing key
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s|^${key}=.*|${key}=${value}|" "$file"
        else
            sed -i "s|^${key}=.*|${key}=${value}|" "$file"
        fi
    else
        # Append new key
        echo "${key}=${value}" >> "$file"
    fi
}

echo "Updating environment settings..."

# Update root .env
if [[ -n "$FE_MODE" ]]; then
    update_env_var "$ROOT_ENV" "VITE_API_MODE" "$FE_MODE"
    if [[ -d "$ROOT_DIR/frontend" ]]; then
        update_env_var "$FRONTEND_ENV" "VITE_API_MODE" "$FE_MODE"
    fi
fi

if [[ -n "$DB_MODE" ]]; then
    update_env_var "$ROOT_ENV" "SESSION_STORAGE_TYPE" "$DB_MODE"
fi

echo "Environment successfully updated!"
echo "========================================================"
echo " Root .env path: $ROOT_ENV"
if [[ -n "$FE_MODE" ]]; then
    echo " Frontend VITE_API_MODE     -> $FE_MODE"
fi
if [[ -n "$DB_MODE" ]]; then
    echo " Backend SESSION_STORAGE_TYPE -> $DB_MODE"
fi
echo "========================================================"
