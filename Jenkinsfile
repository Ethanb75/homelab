pipeline {
    agent any

    environment {
        TF_VAR_proxmox_ve_endpoint = 'https://192.168.1.121:8006/'
        TF_VAR_proxmox_ve_insecure = 'true'
        TF_VAR_proxmox_ve_api_token = credentials('proxmox-api-token')
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
                    sh 'terraform plan -input=false'
                }
            }
        }

        stage('Ansible Test') {
            steps {
                sh 'ansible localhost -m ping -c local'
            }
        }
    }
}