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
