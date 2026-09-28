resource "proxmox_virtual_environment_vm" "rag_api" {
  name        = "rag-api"
  description = "RAG question answering API over the knowledge collection"
  node_name   = "pve-dell-laptop"
  vm_id       = "9150"

  tags = [
    "terraform",
    "rag-api"
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
        address = "192.168.1.133/24"
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
