#!/bin/sh
# Creates the ADTS DynamoDB tables (idempotent) and optionally loads seed data.
set -eu

AWS="aws --endpoint-url ${DYNAMODB_ENDPOINT} --region ${AWS_REGION} --no-cli-pager"

for def in /tables/*.json; do
  name=$(basename "$def" .json)
  if $AWS dynamodb describe-table --table-name "$name" >/dev/null 2>&1; then
    echo "Table exists: $name"
  else
    echo "Creating table: $name"
    $AWS dynamodb create-table --cli-input-json "file://$def" >/dev/null
    $AWS dynamodb wait table-exists --table-name "$name"
  fi
done

if [ "${SEED_DATA}" = "true" ]; then
  for seed in /seed/*.json; do
    echo "Seeding: $(basename "$seed")"
    $AWS dynamodb batch-write-item --request-items "file://$seed" >/dev/null
  done
fi

echo "DynamoDB local ready at http://localhost:8000"
