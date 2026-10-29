#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd "$(dirname "$0")" && pwd)
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.yml"

new_test_run_id() {
  printf '%s-%s-%s' "$(date -u +%Y%m%dT%H%M%SZ)" "$$" "$(od -An -N4 -tx4 /dev/urandom | tr -d ' ')"
}

compose() {
  if command -v podman >/dev/null 2>&1 && podman compose version >/dev/null 2>&1; then
    podman compose -f "$COMPOSE_FILE" "$@"
  elif command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    docker compose -f "$COMPOSE_FILE" "$@"
  elif command -v docker-compose >/dev/null 2>&1; then
    docker-compose -f "$COMPOSE_FILE" "$@"
  else
    echo "Docker Compose or Podman Compose is required to manage the local DynamoDB." >&2
    return 127
  fi
}

require_container_engine() {
  if command -v podman >/dev/null 2>&1; then
    if ! podman info >/dev/null 2>&1; then
      echo "Podman is not running or is not accessible. Start Podman and try again." >&2
      exit 1
    fi
  elif command -v docker >/dev/null 2>&1; then
    if ! docker info >/dev/null 2>&1; then
      echo "Docker or Podman is not running or is not accessible. Start a container engine and try again." >&2
      exit 1
    fi
  else
    echo "Podman or Docker is required to manage the local DynamoDB." >&2
    exit 1
  fi
}

inspect_container() {
  if command -v podman >/dev/null 2>&1 && podman info >/dev/null 2>&1; then
    podman inspect --format '{{.State.Status}}:{{.State.ExitCode}}' "$1"
  else
    docker inspect --format '{{.State.Status}}:{{.State.ExitCode}}' "$1"
  fi
}

validate_seed_data() {
  case "$1" in
    true|false) ;;
    *)
      echo "SEED_DATA must be true or false (received: $1)" >&2
      exit 2
      ;;
  esac
}

show_startup_logs() {
  compose logs --no-color dynamodb init >&2 || true
}

start_database() {
  require_container_engine
  SEED_DATA=${SEED_DATA:-true}
  TEST_RUN_ID=${TEST_RUN_ID:-$(new_test_run_id)}
  validate_seed_data "$SEED_DATA"
  RESET=false
  export SEED_DATA RESET TEST_RUN_ID

  if ! compose up --detach --wait; then
    echo "Could not start local DynamoDB. Check that Podman or Docker is running and host port 8000 is available." >&2
    show_startup_logs
    exit 1
  fi

  if ! compose wait init >/dev/null; then
    echo "The local DynamoDB initialization job did not complete successfully." >&2
    show_startup_logs
    exit 1
  fi

  init_container=$(compose ps --all --quiet init)
  if [ -z "$init_container" ]; then
    echo "The local DynamoDB initialization container was not found after startup." >&2
    show_startup_logs
    exit 1
  fi

  if ! init_result=$(inspect_container "$init_container"); then
    echo "Could not verify the local DynamoDB initialization container." >&2
    show_startup_logs
    exit 1
  fi
  if [ "$init_result" != "exited:0" ]; then
    echo "The local DynamoDB initialization job failed (container state: $init_result)." >&2
    show_startup_logs
    exit 1
  fi

  echo "Local DynamoDB is healthy and initialized at http://localhost:8000."
}

reset_database() {
  require_container_engine
  SEED_DATA=${SEED_DATA:-true}
  TEST_RUN_ID=${TEST_RUN_ID:-$(new_test_run_id)}
  validate_seed_data "$SEED_DATA"
  export SEED_DATA TEST_RUN_ID

  if ! compose run --rm -e RESET=true -e "SEED_DATA=$SEED_DATA" -e "TEST_RUN_ID=$TEST_RUN_ID" init; then
    echo "Could not reset the local DynamoDB tables." >&2
    exit 1
  fi
}

stop_database() {
  require_container_engine
  compose down
}

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 {up|reset|down}" >&2
  exit 2
fi

case "$1" in
  up) start_database ;;
  reset) reset_database ;;
  down) stop_database ;;
  *)
    echo "Usage: $0 {up|reset|down}" >&2
    exit 2
    ;;
esac
