resource "proxmox_virtual_environment_vm" "sample_compose" {
  name        = "sample-compose"
  description = "Disposable CI/CD Docker Compose sample"
  node_name   = var.proxmox_node
  vm_id       = var.sample_vm_id

  tags = [
    "terraform",
    "sample"
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
    ip_config {
      ipv4 {
        address = var.sample_vm_ip
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