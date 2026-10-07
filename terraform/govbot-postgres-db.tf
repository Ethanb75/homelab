resource "proxmox_virtual_environment_vm" "govbot_postgres_db" {
  name        = "govbot-postgres-db"
  description = "PostgreSQL for GovBot executive order metadata and ingest state"
  node_name   = "nuc2"
  vm_id       = "9160"

  tags = [
    "terraform",
    "govbot-postgres-db"
  ]

  stop_on_destroy = true
  pool_id         = "ci-cd"

  clone {
    vm_id     = var.template_vm_id
    node_name = var.template_node
    full      = true
  }

  cpu {
    cores = 2
  }

  memory {
    dedicated = 2048
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
        address = "192.168.1.134/24"
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

  # Unlike the other service VMs this one is stateful - the database lives on its disk - so any
  # plan that would destroy or replace it fails instead. Remove this deliberately if that's wanted.
  lifecycle {
    prevent_destroy = true
  }
}
