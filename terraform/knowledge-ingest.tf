resource "proxmox_virtual_environment_vm" "knowledge_ingest" {
  name        = "knowledge-ingest"
  description = "scheduled knowledge base ingest into the vector db"
  node_name   = "pve-dell-laptop"
  vm_id       = "9140"

  tags = [
    "terraform",
    "knowledge-ingest"
  ]

  stop_on_destroy = true
  pool_id         = "ci-cd"

  clone {
    vm_id     = var.template_vm_id
    node_name = var.template_node
    full      = true
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
        address = "192.168.1.132/24"
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
