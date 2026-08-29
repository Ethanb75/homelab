## Adding a New CI/CD Service

Services in this repository follow the same deployment pattern:

```text
Application files
      │
      ▼
   Jenkins
      │
      ├── Terraform ──► create/update the Proxmox VM
      │
      └── Ansible ────► configure the VM and deploy the application
                            │
                            ▼
                      Docker Compose
```

Each service normally has four pieces:

```text
<service-name>/
terraform/<service-name>.tf
ansible/inventory/<service-name>.ini
ansible/playbooks/deploy-<service-name>.yml
```

The service must also be registered in the `services` map in the root `Jenkinsfile`.

For example, the current repository contains:

```text
sample-app/
personal-web-app/

terraform/
├── sample-compose.tf
└── personal-web-app.tf

ansible/
├── inventory/
│   ├── sample.ini
│   └── personal-web-app.ini
└── playbooks/
    ├── deploy-sample-compose.yml
    └── deploy-personal-web-app.yml
```

### 1. Choose the service settings

Before creating any files, choose values that do not conflict with an existing service.

You will need:

| Setting                 | Example            |
| ----------------------- | ------------------ |
| Service name            | `example-app`      |
| Terraform resource name | `example_app`      |
| VM name                 | `example-app`      |
| VM ID                   | `9120`             |
| VM IP                   | `192.168.1.130`    |
| Application port        | `8090`             |
| Ansible group           | `example_app`      |
| App directory on VM     | `/opt/example-app` |
| Health-check text       | `Example App`      |

The VM ID, IP address, and application port must be unique.

---

### 2. Create the application directory

Create a root-level folder for the service:

```text
example-app/
├── compose.yml
└── site/
    └── index.html
```

The root folder is important because Jenkins uses it to determine which service changed.

For a simple nginx service:

```yaml
# example-app/compose.yml

services:
  web:
    image: nginx:alpine
    restart: unless-stopped

    ports:
      - "8090:80"

    volumes:
      - ./site:/usr/share/nginx/html:ro
```

Example page:

```html
<!-- example-app/site/index.html -->

<!doctype html>
<html>
<head>
    <title>Example App</title>
</head>
<body>
    <h1>Example App</h1>
</body>
</html>
```

The host-side Compose port must match the port configured later in the Jenkins health check.

---

### 3. Create the Terraform VM definition

Create:

```text
terraform/example-app.tf
```

Use one of the existing service files as the template.

```hcl
resource "proxmox_virtual_environment_vm" "example_app" {
  name        = "example-app"
  description = "Example application"
  node_name   = var.proxmox_node

  vm_id = 9120

  tags = [
    "terraform",
    "example-app"
  ]

  stop_on_destroy = true
  pool_id         = "ci-cd"

  clone {
    vm_id = var.template_vm_id
    full  = true
  }

  cpu {
    cores = 1
  }

  memory {
    dedicated = 1024
  }

  network_device {
    bridge = "vmbr0"
  }

  initialization {
    dns {
      servers = ["1.1.1.1", "192.168.1.1"]
    }

    ip_config {
      ipv4 {
        address = "192.168.1.130/24"
        gateway = var.gateway
      }
    }

    user_account {
      username = "deployer"

      keys = [
        trimspace(file("${path.module}/../keys/ci-ansible.pub"))
      ]
    }
  }
}
```

Important values to change:

```text
resource name
VM name
description
VM ID
tags
IP address
CPU/RAM if necessary
```

New CI/CD VMs should remain in the existing:

```text
ci-cd
```

Proxmox resource pool so the existing Terraform permissions apply to them.

The existing cloud-init configuration creates the `deployer` account and installs the public SSH key from:

```text
keys/ci-ansible.pub
```

Jenkins later connects to that account with its corresponding private key.

---

### 4. Create the Ansible inventory

Create:

```text
ansible/inventory/example-app.ini
```

Add the VM:

```ini
[example_app]
example-app ansible_host=192.168.1.130 ansible_user=deployer
```

Keep these values synchronized with Terraform:

```text
VM hostname
VM IP
```

The group name:

```text
example_app
```

will also be referenced by the Ansible playbook and Jenkins.

---

### 5. Create the Ansible deployment playbook

Create:

```text
ansible/playbooks/deploy-example-app.yml
```

The current services use this general pattern:

```yaml
- name: Deploy example app
  hosts: example_app
  become: true

  vars:
    app_dir: /opt/example-app

  tasks:
    - name: Configure DNS
      ansible.builtin.copy:
        dest: /etc/resolv.conf
        content: |
          nameserver 192.168.1.1
          nameserver 1.1.1.1
        owner: root
        group: root
        mode: "0644"

    - name: Install Docker and Docker Compose
      ansible.builtin.apt:
        name:
          - docker.io
          - docker-compose
        state: present
        update_cache: true

    - name: Enable Docker
      ansible.builtin.service:
        name: docker
        state: started
        enabled: true

    - name: Create application directory
      ansible.builtin.file:
        path: "{{ app_dir }}/site"
        state: directory
        mode: "0755"

    - name: Copy Docker Compose file
      ansible.builtin.copy:
        src: ../../example-app/compose.yml
        dest: "{{ app_dir }}/compose.yml"
        mode: "0644"

    - name: Copy website
      ansible.builtin.copy:
        src: ../../example-app/site/index.html
        dest: "{{ app_dir }}/site/index.html"
        mode: "0644"

    - name: Start Docker Compose project
      community.docker.docker_compose_v2:
        project_src: "{{ app_dir }}"
        state: present
        pull: missing
```

Change at least:

```text
play name
hosts
app_dir
source application paths
```

More complex applications can add additional Ansible tasks or copy additional configuration files as necessary.

---

### 6. Register the service in Jenkins

Open the root:

```text
Jenkinsfile
```

At the top of the file is the `services` map.

Add the new service:

```groovy
def services = [
    'sample-compose': [
        inventory: 'ansible/inventory/sample.ini',
        group: 'sample_compose',
        playbook: 'ansible/playbooks/deploy-sample-compose.yml',
        ip: '192.168.1.119',
        port: '8088',
        expected: 'Hello from the homelab CI/CD test!',
        rootFolderName: 'sample-app'
    ],

    'personal-web-app': [
        inventory: 'ansible/inventory/personal-web-app.ini',
        group: 'personal_web_app',
        playbook: 'ansible/playbooks/deploy-personal-web-app.yml',
        ip: '192.168.1.128',
        port: '8089',
        expected: 'Ethan\'s Personal Web App',
        rootFolderName: 'personal-web-app'
    ],

    'example-app': [
        inventory: 'ansible/inventory/example-app.ini',
        group: 'example_app',
        playbook: 'ansible/playbooks/deploy-example-app.yml',
        ip: '192.168.1.130',
        port: '8090',
        expected: 'Example App',
        rootFolderName: 'example-app'
    ]
]
```

The fields have the following meanings:

| Field            | Purpose                                          |
| ---------------- | ------------------------------------------------ |
| `inventory`      | Ansible inventory for the service                |
| `group`          | Ansible inventory group                          |
| `playbook`       | Playbook Jenkins runs                            |
| `ip`             | VM address used for SSH and the health check     |
| `port`           | HTTP port checked after deployment               |
| `expected`       | Text that must appear in the HTTP response       |
| `rootFolderName` | Root application folder that triggers deployment |

The `rootFolderName` value is especially important.

Jenkins checks changed files and selects a service when a changed path starts with its configured application folder.

For example:

```text
example-app/site/index.html
```

matches:

```groovy
rootFolderName: 'example-app'
```

and causes `example-app` to be deployed.

A change to:

```text
personal-web-app/site/index.html
```

does not cause `example-app` to be deployed.

---

### 7. Check formatting and Terraform locally

Before committing, run:

```bash
cd terraform

terraform fmt
terraform validate
terraform plan
```

Review the plan carefully.

For a new service, Terraform should normally show one new VM being created.

Return to the repository root when finished:

```bash
cd ..
```

---

### 8. Verify Ansible configuration

You can verify the inventory with:

```bash
ansible \
  -i ansible/inventory/example-app.ini \
  example_app \
  -m ping \
  --private-key /home/cicd/.ssh/homelab-iac_ed25519
```

This only works after Terraform has created the VM.

You can also run the deployment manually:

```bash
ansible-playbook \
  -i ansible/inventory/example-app.ini \
  ansible/playbooks/deploy-example-app.yml \
  --private-key /home/cicd/.ssh/homelab-iac_ed25519
```

Then test the application:

```bash
curl http://192.168.1.130:8090
```

The response should contain the same text configured in the Jenkins `expected` field:

```text
Example App
```

---

### 9. Commit and push

Add all parts of the new service in the same change:

```bash
git add \
  example-app \
  terraform/example-app.tf \
  ansible/inventory/example-app.ini \
  ansible/playbooks/deploy-example-app.yml \
  Jenkinsfile

git commit -m "Add example app service"
git push
```

Jenkins polls the repository approximately every five minutes.

When it sees the new commit, the pipeline performs:

```text
Checkout
   │
   ▼
Terraform Format
   │
   ▼
Terraform Init
   │
   ▼
Terraform Validate
   │
   ▼
Terraform Plan
   │
   ▼
Terraform Apply
   │
   ▼
Detect changed application folders
   │
   ▼
Wait for SSH
   │
   ▼
Refresh SSH host key
   │
   ▼
Run service Ansible playbook
   │
   ▼
HTTP health check
```

Terraform runs for the entire Terraform configuration, but the Ansible deployment stage is selected per service based on changed application folders.

---

### 10. Verify the Jenkins deployment

A successful first deployment should include stages similar to:

```text
Terraform Format
Terraform Init
Terraform Validate
Terraform Plan
Terraform Apply
Wait for SSH - example-app
Refresh SSH Host Key - example-app
Deploy - example-app
Health Check - example-app
```

Then verify the service directly:

```bash
curl http://192.168.1.130:8090
```

You can also verify that the VM:

* exists in Proxmox
* is in the `ci-cd` pool
* has the expected VM ID
* has the expected IP
* is running Docker
* has the Compose project under `/opt/example-app`

---

## Updating an Existing Service

For normal application updates, change files inside the service's root application directory.

For example:

```text
personal-web-app/
```

A commit that modifies:

```text
personal-web-app/site/index.html
```

will cause Jenkins to select `personal-web-app`, run its Ansible playbook, restart/update the Compose project as necessary, and perform its configured health check.

This allows multiple services to live in the same repository without redeploying every application after every application change.

---

## New Service Checklist

Before pushing a new service, verify:

* [ ] Unique Proxmox VM ID
* [ ] Unique static IP
* [ ] Unique application port where required
* [ ] Root application folder created
* [ ] `compose.yml` created
* [ ] Terraform resource created
* [ ] VM assigned to the `ci-cd` pool
* [ ] `deployer` SSH account configured through cloud-init
* [ ] Ansible inventory created
* [ ] Inventory IP matches Terraform IP
* [ ] Ansible playbook created
* [ ] Playbook `hosts` matches the inventory group
* [ ] Playbook copies files from the correct root application folder
* [ ] Service added to the Jenkins `services` map
* [ ] Jenkins IP matches Terraform/Ansible
* [ ] Jenkins port matches the Docker Compose host port
* [ ] Jenkins `expected` text appears in the application's HTTP response
* [ ] Jenkins `rootFolderName` exactly matches the root application directory
* [ ] `terraform fmt` passes
* [ ] `terraform validate` passes
* [ ] `terraform plan` looks correct

### Important: change detection

The current Jenkins pipeline determines changed services with:

```bash
git diff --name-only HEAD~1 HEAD
```

and only selects services when a changed file is underneath that service's configured `rootFolderName`.

As a result, changing only files such as:

```text
terraform/example-app.tf
ansible/playbooks/deploy-example-app.yml
ansible/inventory/example-app.ini
```

does **not by itself select that service for the Ansible deployment stage**.

Terraform will still run, but Jenkins will only run the per-service Ansible deployment when the commit also contains a change underneath:

```text
example-app/
```

Keep this behavior in mind when making infrastructure-only or Ansible-only changes.
