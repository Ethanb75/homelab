provider "proxmox" {
    endpoint = var.proxmox_ve_endpoint
    api_token = var.proxmox_ve_api_token
    insecure = var.proxmox_ve_insecure
}