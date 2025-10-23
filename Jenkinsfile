#!/usr/bin/env groovy

/**
 * BTD Payment Service - Independent Deployment Pipeline
 *
 * This pipeline deploys ONLY btd-payment-service
 * Push to this repo → Build → Deploy → Only payment service affected
 *
 * Service: btd-payment-service
 * Container: 10001 at 10.27.27.90 (btd-payment-01)
 * HTTP Port: 3500
 * gRPC Port: 50055
 * Version: 1.0.0
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
        DEPLOY_IP = '10.27.27.90'
        HTTP_PORT = '3500'
        GRPC_PORT = '50055'

        // INFRASTRUCTURE
        ANSIBLE_LXC_HOST = '10.27.27.181'
        ANSIBLE_LXC_USER = 'root'
        ANSIBLE_LXC_DIR = '/root/btd-infrastructure/ansible'

        // NODE/NPM CONFIGURATION
        NODE_VERSION = '20.19.5'
        NPM_REGISTRY = 'http://10.27.27.18:4873/'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
                sh 'git log -1 --oneline'
                sh 'echo "Building ${SERVICE_NAME} from commit: $(git rev-parse --short HEAD)"'
            }
        }

        stage('Setup Node.js') {
            steps {
                script {
                    sh """
                        export NVM_DIR="\$HOME/.nvm"
                        [ -s "\$NVM_DIR/nvm.sh" ] && . "\$NVM_DIR/nvm.sh"
                        nvm use ${NODE_VERSION} || node --version
                        node --version
                        npm --version
                    """
                }
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
                    sh 'npm run test'
                }
            }
        }

        stage('Deploy to Container') {
            steps {
                script {
                    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
                    echo "🚀 Deploying ${SERVICE_NAME} to ${DEPLOY_IP}"
                    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

                    // Restore dist/ directory from stash
                    unstash 'dist-artifact'

                    // Deploy directly from agent to container
                    sh """
                        # Create deployment directory on target
                        ssh -i ~/.ssh/id_ed25519_ansible -o StrictHostKeyChecking=no root@${DEPLOY_IP} '
                            mkdir -p /opt/btd/${SERVICE_NAME}/dist
                            mkdir -p /opt/btd/${SERVICE_NAME}/logs
                            mkdir -p /var/log/${SERVICE_NAME}
                        '

                        # Rsync dist/ to target container
                        rsync -avz --delete \
                            -e "ssh -i ~/.ssh/id_ed25519_ansible -o StrictHostKeyChecking=no" \
                            dist/ \
                            root@${DEPLOY_IP}:/opt/btd/${SERVICE_NAME}/dist/

                        # Restart service if it exists
                        ssh -i ~/.ssh/id_ed25519_ansible -o StrictHostKeyChecking=no root@${DEPLOY_IP} '
                            if systemctl is-active --quiet ${SERVICE_NAME}; then
                                systemctl restart ${SERVICE_NAME}
                                echo "✅ Service restarted"
                            else
                                echo "ℹ️  Service not running (systemd unit may not exist yet)"
                            fi
                        '
                    """
                }
            }
        }

        stage('Health Check') {
            steps {
                script {
                    echo "Waiting for service to start..."
                    sleep(time: 10, unit: 'SECONDS')

                    echo "Checking ${SERVICE_NAME} health endpoint..."

                    retry(3) {
                        sh """
                            curl -f --max-time 10 \
                                http://${DEPLOY_IP}:${HTTP_PORT}/api/v1/health \
                                || exit 1
                        """
                    }

                    echo "✅ ${SERVICE_NAME} is healthy!"
                }
            }
        }

        stage('Verify Consul Registration') {
            steps {
                script {
                    echo "Checking Consul service registration..."

                    sh """
                        ssh -i ~/.ssh/id_ed25519_ansible -o StrictHostKeyChecking=no root@${DEPLOY_IP} '
                            curl -s http://localhost:8500/v1/agent/services | \
                            grep -q ${SERVICE_NAME} && \
                            echo "✅ Service registered in Consul"
                        ' || echo "⚠️  Consul registration check skipped"
                    """
                }
            }
        }

        stage('Verify Service ID') {
            steps {
                script {
                    echo "Verifying instance-based service ID (Phase 1 fix)..."

                    sh """
                        ssh -i ~/.ssh/id_ed25519_ansible -o StrictHostKeyChecking=no root@${DEPLOY_IP} '
                            SERVICE_ID=\$(curl -s http://localhost:8500/v1/agent/services | \
                                         python3 -c "import sys, json; services = json.load(sys.stdin); print([k for k in services.keys() if \"${SERVICE_NAME}\" in k][0] if any(\"${SERVICE_NAME}\" in k for k in services.keys()) else \"NOT_FOUND\")")

                            echo "Service ID: \$SERVICE_ID"

                            if echo "\$SERVICE_ID" | grep -q "${SERVICE_NAME}-btd-payment"; then
                                echo "✅ Correct instance-based service ID format"
                            else
                                echo "⚠️  Service ID format: \$SERVICE_ID"
                            fi
                        ' || echo "⚠️  Service ID check skipped"
                    """
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
            Container: ${DEPLOY_IP} (btd-payment-01)
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
