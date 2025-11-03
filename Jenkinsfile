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

                        # Transfer Prisma schema (required for prisma generate)
                        rsync -avz \
                            -e "ssh -i ~/.ssh/id_jenkins_to_ansible -o StrictHostKeyChecking=no" \
                            prisma/ \
                            ${ANSIBLE_LXC_USER}@${ANSIBLE_LXC_HOST}:\${DEPLOY_DIR}/prisma/

                        # Transfer proto files (required for gRPC runtime)
                        rsync -avz \
                            -e "ssh -i ~/.ssh/id_jenkins_to_ansible -o StrictHostKeyChecking=no" \
                            src/proto/ \
                            ${ANSIBLE_LXC_USER}@${ANSIBLE_LXC_HOST}:\${DEPLOY_DIR}/src/proto/

                        # Trigger Ansible deployment playbook
                        ssh -i ~/.ssh/id_jenkins_to_ansible -o StrictHostKeyChecking=no ${ANSIBLE_LXC_USER}@${ANSIBLE_LXC_HOST} \
                            "cd ${ANSIBLE_LXC_DIR} && \
                             ansible-playbook playbooks/deploy-${SERVICE_NAME}.yml \
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

    parameters {
        booleanParam(
            name: 'SKIP_TESTS',
            defaultValue: false,
            description: 'Skip lint and unit tests (faster deployment)'
        )
    }
}
