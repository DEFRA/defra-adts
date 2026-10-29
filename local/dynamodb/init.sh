#!/bin/sh
# Creates the ADTS DynamoDB tables and optionally loads seed data.
set -eu

AWS="aws --endpoint-url ${DYNAMODB_ENDPOINT} --region ${AWS_REGION} --no-cli-pager"
RESET="${RESET:-false}"
SEED_DATA="${SEED_DATA:-true}"

case "$RESET" in
  true|false) ;;
  *)
    echo "RESET must be true or false (received: $RESET)" >&2
    exit 1
    ;;
esac

case "$SEED_DATA" in
  true|false) ;;
  *)
    echo "SEED_DATA must be true or false (received: $SEED_DATA)" >&2
    exit 1
    ;;
esac

for def in /tables/*.json; do
  name=$(basename "$def" .json)
  if $AWS dynamodb describe-table --table-name "$name" >/dev/null 2>&1; then
    if [ "$RESET" = "true" ]; then
      echo "Deleting table: $name"
      $AWS dynamodb delete-table --table-name "$name" >/dev/null
      $AWS dynamodb wait table-not-exists --table-name "$name"
    else
      echo "Table exists: $name"
    fi
  fi

  if ! $AWS dynamodb describe-table --table-name "$name" >/dev/null 2>&1; then
    echo "Creating table: $name"
    $AWS dynamodb create-table --cli-input-json "file://$def" >/dev/null
    $AWS dynamodb wait table-exists --table-name "$name"
  fi
done

for seed in /seed/*.json; do
  item_count=$(grep -o '"PutRequest"[[:space:]]*:' "$seed" | wc -l | tr -d '[:space:]')
  if [ "$item_count" -gt 25 ]; then
    echo "Seed file $(basename "$seed") contains $item_count items; DynamoDB batches support at most 25." >&2
    exit 1
  fi

  if [ "$SEED_DATA" = "true" ]; then
    echo "Seeding: $(basename "$seed")"
    $AWS dynamodb batch-write-item --request-items "file://$seed" >/dev/null
  fi
done

echo "DynamoDB local ready at http://localhost:8000"
