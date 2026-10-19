#!/usr/bin/env bash
echo "Creating SonarQube project ${SONAR_PROJECT_KEY}"

curl \
  --fail-with-body \
  --request POST \
  --header "Authorization: Bearer ${SONAR_TOKEN}" \
  --header "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "organization=${SONAR_ORGANIZATION}" \
  --data-urlencode "project=${SONAR_PROJECT_KEY}" \
  --data-urlencode "name=${SONAR_PROJECT_NAME}" \
  "https://sonarcloud.io/api/projects/create"
