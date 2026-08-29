resource "proxmox_virtual_environment_vm" "personal_web_app" {
  name        = "personal-web-app"
  description = "Personal web and web facing"
  node_name   = "pve-infra-02"
  vm_id       = "9110"

  tags = [
    "terraform",
    "personal-web-app"
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
        address = "192.168.1.128/24"
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