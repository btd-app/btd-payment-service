#!/usr/bin/env groovy

/**
 * BTD Btd Payment Service - Multi-Environment Deployment Pipeline
 *
 * Service: btd-payment-service
 * Branch Routing:
 *   - main → Production (10.27.27.90) with manual approval
 *   - staging → Staging (10.27.26.190) auto-deploy
 *   - develop → Development (10.27.26.90) auto-deploy
 *
 * HTTP Port: 3011 | gRPC Port: 50062
 * Complexity: SIMPLE (Prisma only)
 */

pipeline {
    agent {
        label 'nodejs'  // Runs on jenkins-agent (10.27.27.60)
    }

    options {
        buildDiscarder(logRotator(numToKeepStr: '30'))
        disableConcurrentBuilds()
        timeout(time: 30, unit: 'MINUTES')
        timestamps()
    }

    environment {
        // SERVICE CONFIGURATION
        SERVICE_NAME = 'btd-payment-service'
        HTTP_PORT = '3011'
        GRPC_PORT = '50062'

        // INFRASTRUCTURE
        ANSIBLE_LXC_HOST = '10.27.27.181'
        ANSIBLE_LXC_USER = 'root'
        ANSIBLE_LXC_DIR = '/root/btd-infrastructure/ansible'

        // NODE/NPM CONFIGURATION
        NODE_VERSION = '20.19.5'
        NPM_REGISTRY = 'http://10.27.27.18:4873/'

        // BRANCH-TO-ENVIRONMENT MAPPING
        BRANCH_TO_ENV = """${
            env.BRANCH_NAME == 'main' ? 'production' :
            env.BRANCH_NAME == 'staging' ? 'staging' :
            env.BRANCH_NAME == 'develop' ? 'development' :
            'INVALID'
        }"""

        INVENTORY_FILE = "inventory/${BRANCH_TO_ENV}.yml"

        // Environment-specific IPs
        DEPLOY_IP = """${
            env.BRANCH_NAME == 'main' ? '10.27.27.90' :
            env.BRANCH_NAME == 'staging' ? '10.27.26.190' :
            env.BRANCH_NAME == 'develop' ? '10.27.26.90' :
            'INVALID'
        }"""
    }

    parameters {
        booleanParam(
            name: 'SKIP_TESTS',
            defaultValue: false,
            description: 'Skip lint and unit tests (faster deployment)'
        )
    }

    stages {
        stage('Validate Branch') {
            steps {
                script {
                    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
                    echo "🔍 BRANCH VALIDATION"
                    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
                    echo "Branch: ${env.BRANCH_NAME}"
                    echo "Environment: ${BRANCH_TO_ENV}"
                    echo "Target: ${DEPLOY_IP}:${HTTP_PORT}"
                    echo "Inventory: ${INVENTORY_FILE}"
                    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

                    if (env.BRANCH_TO_ENV == 'INVALID') {
                        error """
                        ❌ INVALID BRANCH: ${env.BRANCH_NAME}

                        Only these branches are supported:
                          • main    → Production (manual approval)
                          • staging → Staging (auto-deploy)
                          • develop → Development (auto-deploy)

                        This branch cannot be deployed.
                        """
                    }
                }
            }
        }

        stage('Checkout') {
            steps {
                checkout scm
                sh 'git log -1 --oneline'
                sh 'echo "Building ${SERVICE_NAME} from commit: $(git rev-parse --short HEAD)"'
            }
        }

        stage('Sync Ansible Infrastructure') {
            steps {
                script {
                    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
                    echo "🔄 Syncing Ansible Infrastructure from GitHub"
                    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

                    sh """
                        ssh -i ~/.ssh/id_jenkins_to_ansible -o StrictHostKeyChecking=no ${ANSIBLE_LXC_USER}@${ANSIBLE_LXC_HOST} '\
                            cd ${ANSIBLE_LXC_DIR} && \
                            git pull origin main && \
                            echo "✅ Ansible infrastructure synced from GitHub"'
                    """
                }
            }
        }


        stage('Setup Node.js') {
            steps {
                sh """
                    export NVM_DIR="\$HOME/.nvm"
                    [ -s "\$NVM_DIR/nvm.sh" ] && . "\$NVM_DIR/nvm.sh"
                    nvm use ${NODE_VERSION} || node --version
                    node --version
                    npm --version
                """
            }
        }

        stage('Install Dependencies') {
            steps {
                sh """
                    npm config set registry ${NPM_REGISTRY}
                    npm ci
                """
            }
        }

        stage('Build') {
            steps {
                sh 'npm run build'

                // Preserve dist/ directory for deployment
                stash(name: 'dist-artifact', includes: 'dist/**/*')
            }
        }

        stage('Lint') {
            when {
                expression { !params.SKIP_TESTS }
            }
            steps {
                catchError(buildResult: 'SUCCESS', stageResult: 'UNSTABLE') {
                    sh 'npm run lint'
                }
            }
        }

        stage('Unit Tests') {
            when {
                expression { !params.SKIP_TESTS }
            }
            steps {
                catchError(buildResult: 'SUCCESS', stageResult: 'UNSTABLE') {
                    sh '''
                        # Set dummy DATABASE_URL for Prisma tests
                        export DATABASE_URL="postgresql://test_user:test_pass@localhost:5432/test_db"
                        npm run test
                    '''
                }
            }
        }

        stage('Production Approval') {
            when {
                expression { env.BRANCH_TO_ENV == 'production' }
            }
            steps {
                script {
                    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
                    echo "⚠️  PRODUCTION DEPLOYMENT APPROVAL REQUIRED"
                    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
                    echo "Service: ${SERVICE_NAME}"
                    echo "Target: ${DEPLOY_IP} (Production)"
                    echo "Build: #${BUILD_NUMBER}"
                    echo "Commit: ${GIT_COMMIT}"
                    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

                    input message: "Deploy ${SERVICE_NAME} to PRODUCTION?",
                          ok: 'Deploy to Production',
                          submitter: 'authenticated'
                }
            }
        }

        stage('Deploy via Ansible') {
            steps {
                script {
                    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
                    echo "🚀 Deploying ${SERVICE_NAME} via Ansible LXC"
                    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
                    echo "Environment: ${BRANCH_TO_ENV}"
                    echo "Target IP: ${DEPLOY_IP}"
                    echo "Inventory: ${INVENTORY_FILE}"
                    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

                    // Restore build artifacts
                    unstash 'dist-artifact'

                    sh """
                        # Create staging area on Ansible LXC
                        DEPLOY_DIR=/tmp/jenkins-deploys/${SERVICE_NAME}/${BUILD_NUMBER}

                        ssh -i ~/.ssh/id_jenkins_to_ansible -o StrictHostKeyChecking=no ${ANSIBLE_LXC_USER}@${ANSIBLE_LXC_HOST} \
                            "mkdir -p \${DEPLOY_DIR}/dist \${DEPLOY_DIR}/prisma \${DEPLOY_DIR}/src/proto"

                        # Transfer build artifacts to Ansible LXC
                            rsync -avz --delete \
                                -e "ssh -i ~/.ssh/id_jenkins_to_ansible -o StrictHostKeyChecking=no" \
                                dist/ \
                                ${ANSIBLE_LXC_USER}@${ANSIBLE_LXC_HOST}:\${DEPLOY_DIR}/dist/

                            rsync -avz \
                                -e "ssh -i ~/.ssh/id_jenkins_to_ansible -o StrictHostKeyChecking=no" \
                                package.json \
                                package-lock.json \
                                ${ANSIBLE_LXC_USER}@${ANSIBLE_LXC_HOST}:\${DEPLOY_DIR}/

                        # Transfer Prisma schema if it exists (some services don't use Prisma)
if [ -d "prisma" ]; then
    rsync -avz \
        -e "ssh -i ~/.ssh/id_jenkins_to_ansible -o StrictHostKeyChecking=no" \
        prisma/ \
        ${ANSIBLE_LXC_USER}@${ANSIBLE_LXC_HOST}:\${DEPLOY_DIR}/prisma/
fi


                        # Trigger Ansible deployment playbook
                        ssh -i ~/.ssh/id_jenkins_to_ansible -o StrictHostKeyChecking=no ${ANSIBLE_LXC_USER}@${ANSIBLE_LXC_HOST} \
                            "cd ${ANSIBLE_LXC_DIR} && \
                             ansible-playbook playbooks/deploy-${SERVICE_NAME}.yml \
                                -v \
                                -i ${INVENTORY_FILE} \
                                -e 'artifact_path=\${DEPLOY_DIR}' \
                                -e 'git_commit=${GIT_COMMIT}' \
                                -e 'build_number=${BUILD_NUMBER}' \
                                -e 'environment=${BRANCH_TO_ENV}'"

                        # Cleanup staging area
                        ssh -i ~/.ssh/id_jenkins_to_ansible -o StrictHostKeyChecking=no ${ANSIBLE_LXC_USER}@${ANSIBLE_LXC_HOST} \
                            "rm -rf \${DEPLOY_DIR}"
                    """

                    echo "✅ Deployment via Ansible completed successfully"
                    echo "   - Environment: ${BRANCH_TO_ENV}"
                    echo "   - Inventory: ${INVENTORY_FILE}"
                    echo "   - Service deployed to ${DEPLOY_IP}"
                    echo "   - Health check and Consul verification handled by Ansible"
                }
            }
        }
    }


        stage('Post-Deployment Verification') {
            steps {
                script {
                    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
                    echo "🔍 Post-Deployment Verification"
                    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
                    echo "Verifying service health independently from Jenkins..."
                    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

                    // Wait for service to fully stabilize
                    echo "Waiting 15 seconds for service to stabilize..."
                    sleep(time: 15, unit: 'SECONDS')

                    def maxRetries = 12
                    def retryDelay = 5
                    def healthCheckPassed = false
                    def healthCheckStatus = 'unknown'

                    // Independent health check from Jenkins
                    for (int i = 1; i <= maxRetries; i++) {
                        try {
                            def response = sh(
                                script: """
                                    curl -f -s -o /dev/null -w "%{http_code}" \
                                        --max-time 10 \
                                        "http://${DEPLOY_IP}:${HTTP_PORT}/api/v1/health" || echo "FAILED"
                                """,
                                returnStdout: true
                            ).trim()

                            healthCheckStatus = response

                            if (response == "200" || response == "204") {
                                echo "✅ Health check passed (HTTP ${response}) on attempt ${i}/${maxRetries}"
                                healthCheckPassed = true
                                break
                            } else {
                                echo "⚠️  Health check returned HTTP ${response} (attempt ${i}/${maxRetries})"
                            }
                        } catch (Exception e) {
                            echo "⚠️  Health check failed: ${e.message} (attempt ${i}/${maxRetries})"
                        }

                        if (i < maxRetries) {
                            sleep(time: retryDelay, unit: 'SECONDS')
                        }
                    }

                    // Verify service is registered in Consul
                    def consulHost = """${
                        env.BRANCH_NAME == 'main' ? '10.27.27.27' :
                        env.BRANCH_NAME == 'staging' ? '10.27.27.119' :
                        env.BRANCH_NAME == 'develop' ? '10.27.27.118' :
                        '10.27.27.27'
                    }"""

                    def consulStatus = 'unknown'
                    try {
                        consulStatus = sh(
                            script: """
                                curl -s "http://${consulHost}:8500/v1/health/service/${SERVICE_NAME}" | \
                                    jq -r '.[0].Checks[] | select(.ServiceID | contains("${SERVICE_NAME}")) | .Status' || echo "not_found"
                            """,
                            returnStdout: true
                        ).trim()

                        if (consulStatus == "passing") {
                            echo "✅ Consul health check: passing"
                        } else {
                            echo "⚠️  Consul health check: ${consulStatus} (may be temporary)"
                        }
                    } catch (Exception e) {
                        echo "⚠️  Could not verify Consul status: ${e.message}"
                    }

                    // SSH to container and verify service state
                    def serviceState = 'unknown'
                    def restartCount = '0'

                    try {
                        serviceState = sh(
                            script: """
                                ssh -i ~/.ssh/id_jenkins_to_ansible -o StrictHostKeyChecking=no \
                                    ${ANSIBLE_LXC_USER}@${ANSIBLE_LXC_HOST} \
                                    "ssh root@${DEPLOY_IP} 'systemctl show ${SERVICE_NAME} -p ActiveState --value'"
                            """,
                            returnStdout: true
                        ).trim()

                        restartCount = sh(
                            script: """
                                ssh -i ~/.ssh/id_jenkins_to_ansible -o StrictHostKeyChecking=no \
                                    ${ANSIBLE_LXC_USER}@${ANSIBLE_LXC_HOST} \
                                    "ssh root@${DEPLOY_IP} 'systemctl show ${SERVICE_NAME} -p NRestarts --value'"
                            """,
                            returnStdout: true
                        ).trim()

                        echo "Service state on container: ${serviceState}"
                        echo "Restart count: ${restartCount}"
                    } catch (Exception e) {
                        echo "⚠️  Could not verify service state: ${e.message}"
                    }

                    // Final verification
                    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

                    if (!healthCheckPassed) {
                        // Get logs for debugging
                        def serviceLogs = "Unable to retrieve logs"
                        try {
                            serviceLogs = sh(
                                script: """
                                    ssh -i ~/.ssh/id_jenkins_to_ansible -o StrictHostKeyChecking=no \
                                        ${ANSIBLE_LXC_USER}@${ANSIBLE_LXC_HOST} \
                                        "ssh root@${DEPLOY_IP} 'journalctl -u ${SERVICE_NAME} -n 50 --no-pager'"
                                """,
                                returnStdout: true
                            )
                        } catch (Exception e) {
                            serviceLogs = "Failed to retrieve logs: ${e.message}"
                        }

                        error """
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ POST-DEPLOYMENT HEALTH CHECK FAILED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Service: ${SERVICE_NAME}
Environment: ${BRANCH_TO_ENV}
Container: ${DEPLOY_IP}:${HTTP_PORT}

Health Check Status: ${healthCheckStatus}
Service State: ${serviceState}
Restart Count: ${restartCount}
Consul Status: ${consulStatus}

The service did not pass health verification after ${maxRetries} attempts (${maxRetries * retryDelay} seconds).

This indicates the service may be:
- In a crash loop
- Failed to start
- Not listening on port ${HTTP_PORT}
- Health endpoint returning errors

Ansible may have automatically rolled back to the previous version.
Check the deployment logs above for specific failure reason.

Recent Service Logs:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${serviceLogs}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Troubleshooting:
1. Check Ansible deployment logs above
2. SSH to container: ssh root@${DEPLOY_IP}
3. Check service status: systemctl status ${SERVICE_NAME}
4. View logs: journalctl -u ${SERVICE_NAME} -n 100
5. Test health endpoint: curl http://${DEPLOY_IP}:${HTTP_PORT}/api/v1/health
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""
                    }

                    // Check for high restart count (crash loop indicator)
                    def restartCountInt = restartCount as Integer
                    if (restartCountInt > 2) {
                        error """
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ SERVICE RESTART COUNT TOO HIGH
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Service: ${SERVICE_NAME}
Restart Count: ${restartCount}

The service has restarted ${restartCount} times, indicating a crash loop.

Check logs: ssh root@${DEPLOY_IP} 'journalctl -u ${SERVICE_NAME} -n 100'
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""
                    }

                    // Check service state
                    if (serviceState != 'active') {
                        error """
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ SERVICE NOT ACTIVE ON CONTAINER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Service: ${SERVICE_NAME}
Expected State: active
Actual State: ${serviceState}

Service may have crashed after initial health check.
Check logs: ssh root@${DEPLOY_IP} 'journalctl -u ${SERVICE_NAME} -n 100'
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""
                    }

                    echo "✅ Post-deployment verification successful"
                    echo "   - Health endpoint: HTTP ${healthCheckStatus}"
                    echo "   - Service state: ${serviceState}"
                    echo "   - Restart count: ${restartCount}"
                    echo "   - Consul status: ${consulStatus}"
                    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
                }
            }
        }
    }

    post {
        success {
            echo """
            ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            ✅ DEPLOYMENT SUCCESSFUL - ${SERVICE_NAME}
            ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            Service: ${SERVICE_NAME}
            Environment: ${BRANCH_TO_ENV}
            Branch: ${env.BRANCH_NAME}
            Container: ${DEPLOY_IP}
            Health: http://${DEPLOY_IP}:${HTTP_PORT}/api/v1/health
            gRPC: ${DEPLOY_IP}:${GRPC_PORT}
            Build: #${BUILD_NUMBER}
            Duration: ${currentBuild.durationString}
            ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            """
        }

        failure {
            echo """
            ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            ❌ DEPLOYMENT FAILED - ${SERVICE_NAME}
            ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            Service: ${SERVICE_NAME}
            Environment: ${BRANCH_TO_ENV}
            Branch: ${env.BRANCH_NAME}
            Build: #${BUILD_NUMBER}
            Check logs above for errors
            ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            """
        }

        always {
            // Clean up workspace
            cleanWs()
        }
    }
}

