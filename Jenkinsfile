pipeline {
    agent any

    environment {
        TF_VAR_proxmox_ve_endpoint  = 'https://192.168.1.121:8006/'
        TF_VAR_proxmox_ve_insecure  = 'true'
        TF_VAR_proxmox_ve_api_token = credentials('proxmox-api-token')
        TF_VAR_proxmox_node         = 'pve-infra-02'
        TF_VAR_template_vm_id       = '100'
        TF_VAR_sample_vm_id         = '9100'
        TF_VAR_sample_vm_ip         = '192.168.1.119/24'
        TF_VAR_gateway              = '192.168.1.1'
    }

    triggers {
        // Poll gh every 5 minutes
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

        // stage('Approval') {
        //     steps {
        //         input message: 'Apply this Terraform plan?',
        //               ok: 'Deploy'
        //     }
        // }

        stage('Terraform Apply') {
            steps {
                dir('terraform') {
                    sh 'terraform apply -input=false -auto-approve tfplan'
                }
            }
        }

        stage('Weird wait for SSH') {
            steps {
                sh 'sleep 240'
            }
        }

        // stage('Wait for SSH') {
        //     steps {
        //         sshagent(credentials: ['homelab-iac']) {
        //             sh '''
        //                 for i in $(seq 1 30); do
        //                     if ssh \
        //                         -o BatchMode=yes \
        //                         -o StrictHostKeyChecking=no \
        //                         -o ConnectTimeout=5 \
        //                         deployer@192.168.1.119 true; then
        //                         echo "SSH is ready"
        //                         exit 0
        //                     fi

        //                     echo "Waiting for SSH..."
        //                     sleep 5
        //                 done

        //                 echo "SSH did not become available"
        //                 exit 1
        //             '''
        //         }
        //     }
        // }

        stage('Refresh SSH Host Key') {
            steps {
                sh '''
                    VM_IP="192.168.1.119"

                    mkdir -p "$HOME/.ssh"
                    chmod 700 "$HOME/.ssh"

                    ssh-keygen \
                        -f "$HOME/.ssh/known_hosts" \
                        -R "$VM_IP" || true

                    ssh-keyscan \
                        -H \
                        -t ed25519 \
                        "$VM_IP" \
                        >> "$HOME/.ssh/known_hosts"

                    chmod 600 "$HOME/.ssh/known_hosts"
                '''
            }
        }

        stage('Ansible Deploy') {
            steps {
                sshagent(credentials: ['homelab-iac']) {
                    sh '''
                        ansible-playbook \
                          -i ansible/inventory/sample.ini \
                          ansible/playbooks/deploy-sample-compose.yml
                    '''
                }
            }
        }

        stage('Application Test') {
            steps {
                sh '''
                    curl --fail \
                         --retry 10 \
                         --retry-delay 3 \
                         http://192.168.1.119:8088
                '''
            }
        }
    }
}