resource "proxmox_virtual_environment_vm" "vector_db" {
  name        = "vector-db"
  description = "vector db for knowledge assistant"
  node_name   = "nuc2"
  vm_id       = "9130"

  tags = [
    "terraform",
    "vector-db"
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
    cores   = 2
    type    = "host"

  }

  memory {
    dedicated = 2048
    floating  = 0
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
        address = "192.168.1.131/24"
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