def services = [
    'sample-compose': [
        inventory: 'ansible/inventory/sample.ini',
        group: 'sample_compose',
        playbook: 'ansible/playbooks/deploy-sample-compose.yml',
        ip: '192.168.1.119',
        port: '8088',
        expected: 'Hello from the homelab CI/CD test!'
    ],

    'personal-web-app': [
        inventory: 'ansible/inventory/personal-web-app.ini',
        group: 'personal_web_app',
        playbook: 'ansible/playbooks/deploy-personal-web-app.yml',
        ip: '192.168.1.128',
        port: '8089',
        expected: 'Ethan\'s Personal Web App'
    ]
]

def selectedServices(Map services, String selected) {
    if (selected == 'all') {
        return services.keySet() as List
    }

    return [selected]
}

def waitForSsh(Map service) {
    sh """
      for i in \$(seq 1 30); do
        ssh \
          -o BatchMode=yes \
          -o StrictHostKeyChecking=accept-new \
          -o ConnectTimeout=5 \
          -i /var/lib/jenkins/.ssh/homelab-iac_ed25519 \
          deployer@${service.ip} 'echo SSH ready' && exit 0

        echo "Waiting for SSH on ${service.ip}..."
        sleep 10
      done

      echo "SSH did not become ready on ${service.ip}"
      exit 1
    """
}

def refreshSshHostKey(Map service) {
    sh """
      mkdir -p /var/lib/jenkins/.ssh
      chmod 700 /var/lib/jenkins/.ssh

      ssh-keygen \
        -f /var/lib/jenkins/.ssh/known_hosts \
        -R ${service.ip} || true

      ssh-keyscan \
        -H \
        -t ed25519 \
        ${service.ip} \
        >> /var/lib/jenkins/.ssh/known_hosts

      chmod 600 /var/lib/jenkins/.ssh/known_hosts
    """
}

def deployService(Map service) {
    sh """
      ansible-playbook \
        -i ${service.inventory} \
        ${service.playbook} \
        --private-key /var/lib/jenkins/.ssh/homelab-iac_ed25519
    """
}

def healthCheck(Map service) {
    sh """
      curl \
        --fail \
        --show-error \
        --silent \
        http://${service.ip}:${service.port} | grep "${service.expected}"
    """
}

pipeline {
    agent any

    // parameters {
    //     choice(
    //         name: 'SERVICE',
    //         choices: ['all', 'sample-compose', 'personal-web-app'],
    //         description: 'Which service should Jenkins deploy?'
    //     )
    // }

    environment {
        TF_VAR_proxmox_ve_endpoint  = 'https://192.168.1.121:8006/'
        TF_VAR_proxmox_ve_insecure = 'true'
        TF_VAR_proxmox_ve_api_token = credentials('proxmox-api-token')
    }

    triggers {
        pollSCM('H/5 * * * *')
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Terraform Format') {
            steps {
                dir('terraform') {
                    sh 'terraform fmt -check'
                }
            }
        }

        stage('Terraform Init') {
            steps {
                dir('terraform') {
                    sh 'terraform init -input=false'
                }
            }
        }

        stage('Terraform Validate') {
            steps {
                dir('terraform') {
                    sh 'terraform validate'
                }
            }
        }

        stage('Terraform Plan') {
            steps {
                dir('terraform') {
                    sh 'terraform plan -input=false -out=tfplan'
                }
            }
        }

        // stage('Manual Approval') {
        //     steps {
        //         input message: "Apply Terraform changes and deploy ${params.SERVICE}?"
        //     }
        // }

        stage('Terraform Apply') {
            steps {
                dir('terraform') {
                    sh 'terraform apply -input=false tfplan'
                }
            }
        }

        

        stage('Deploy Selected Services') {
            steps {
                script {

                    selectedServices(services, 'all').each { serviceName ->
                        def service = services[serviceName]

                        stage("Wait for SSH - ${serviceName}") {
                            waitForSsh(service)
                            // wait 120 seconds
                            // sleep 120
                        }

                        stage("Refresh SSH Host Key - ${serviceName}") {
                            refreshSshHostKey(service)
                        }

                        stage("Deploy - ${serviceName}") {
                            deployService(service)
                        }

                        stage("Health Check - ${serviceName}") {
                            healthCheck(service)
                        }
                    }
                }
            }
        }
    }

    post {
        success {
            echo "Deployment completed successfully."
        }

        failure {
            echo "Deployment failed."
        }
    }
}