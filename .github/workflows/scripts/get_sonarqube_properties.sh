PROPERTIES_FILE="services/${{ inputs.service-directory }}/sonar-project.properties"

SONAR_PROJECT_KEY=$(grep '^sonar.projectKey=' "$PROPERTIES_FILE" | cut -d'=' -f2-)
SONAR_ORGANIZATION=$(grep '^sonar.organization=' "$PROPERTIES_FILE" | cut -d'=' -f2-)
SONAR_PROJECT_NAME=$(grep '^sonar.projectName=' "$PROPERTIES_FILE" | cut -d'=' -f2-)

echo "SONAR_PROJECT_KEY=${SONAR_PROJECT_KEY}" >> "$GITHUB_ENV"
echo "SONAR_ORGANIZATION=${SONAR_ORGANIZATION}" >> "$GITHUB_ENV"
echo "SONAR_PROJECT_NAME=${SONAR_PROJECT_NAME}" >> "$GITHUB_ENV"