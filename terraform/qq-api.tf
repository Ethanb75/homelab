resource "proxmox_virtual_environment_vm" "qq_api" {
  name        = "qq-api"
  description = "lamma.cpp qq api"
  node_name   = "nuc2"
  vm_id       = "9120"

  tags = [
    "terraform",
    "qq"
  ]

  stop_on_destroy = true
  pool_id         = "ci-cd"

  clone {
    vm_id     = var.template_vm_id
    node_name = var.template_node
    full      = true
  }

  cpu {
    sockets = 1
    cores   = 6
    type    = "host"

  }

  memory {
    dedicated = 12288
    floating = 0
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