variable "proxmox_ve_api_token" {
  description = "Proxmox VE API token for authentication"
  type        = string
  sensitive   = true
}

variable "proxmox_ve_endpoint" {
  description = "Proxmox VE API endpoint"
  type        = string
  sensitive   = true
}

variable "proxmox_ve_insecure" {
  description = "Whether to skip SSL verification for Proxmox VE API"
  type        = bool
  default     = false
}

variable "proxmox_node" {
  type    = string
  default = "pve-infra-02"
}

variable "template_vm_id" {
  type    = number
  default = 100
}

variable "sample_vm_id" {
  type    = number
  default = 9100
}

variable "sample_vm_ip" {
  type    = string
  default = "192.168.1.119/24"
}

variable "gateway" {
  type    = string
  default = "192.168.1.1"
}
