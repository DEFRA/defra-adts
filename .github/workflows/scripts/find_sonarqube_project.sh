#!/usr/bin/env bash
HTTP_STATUS=$(curl \
  --silent \
  --output /dev/null \
  --write-out "%{http_code}" \
  --header "Authorization: Bearer ${SONAR_TOKEN}" \
  "https://sonarcloud.io/api/projects/search?projects=${SONAR_PROJECT_KEY}")

if [[ "${HTTP_STATUS}" != "200" ]]; then
  echo "SonarQube API returned HTTP ${HTTP_STATUS}"
  exit 1
fi

RESPONSE=$(curl \
  --silent \
  --fail \
  --header "Authorization: Bearer ${SONAR_TOKEN}" \
  "https://sonarcloud.io/api/projects/search?projects=${SONAR_PROJECT_KEY}")

COUNT=$(echo "${RESPONSE}" | jq '.paging.total')

if [[ "${COUNT}" -eq 0 ]]; then
  echo "exists=false" >> "${GITHUB_OUTPUT}"
  echo "Project ${SONAR_PROJECT_KEY} does not exist."
else
  echo "exists=true" >> "${GITHUB_OUTPUT}"
  echo "Project ${SONAR_PROJECT_KEY} exists."
fi
