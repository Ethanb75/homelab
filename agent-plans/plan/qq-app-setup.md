I reviewed the current `main` branch of your repo. The existing CI/CD design is already a strong match for this service, so I would extend it rather than restructure it. [Open the homelab repo](https://github.com/Ethanb75/homelab?utm_source=chatgpt.com)

## Current state I see

Your repo has settled into a consistent service pattern:

```text
homelab/
├── terraform/
├── ansible/
│   ├── inventory/
│   └── playbooks/
├── keys/
├── sample-app/
├── personal-web-app/
├── Jenkinsfile
└── ADDING_SERVICES.md
```

`ADDING_SERVICES.md` explicitly defines the architecture as application files → Jenkins → Terraform for the Proxmox VM → Ansible for configuration → Docker Compose for the application. It also documents the convention of one root application directory, one Terraform resource, one inventory, one playbook, and one entry in the Jenkins service map. ([github.com][1])

Terraform is currently using `bpg/proxmox` `0.111.1`. Your shared template is VM `100` on `pve-infra-02`, and your default target node is also `pve-infra-02`. The sample service is VM `9100` at `192.168.1.119`; the personal web app is VM `9110` at `192.168.1.128` and is explicitly placed on `pve-dell-laptop`. That personal-web-app resource is especially relevant because it already proves your intended pattern of cloning the template from `pve-infra-02` while placing the resulting VM on another Proxmox node. ([GitHub][2])

Your Jenkins pipeline already performs Terraform format/init/validate/plan/apply globally, then selectively deploys applications. It polls Git every five minutes and detects application changes with `git diff --name-only HEAD~1 HEAD`. Right now it only selects a service when a changed path begins with that service's `rootFolderName`. ([GitHub][3])

One limitation matters for llama.cpp: your current health check immediately requests the service root and greps for text. llama.cpp has a proper `/health` endpoint and returns `503` while loading the model, then `200` when ready. A model can take noticeably longer to initialize than nginx, so we should improve the generic Jenkins health check rather than hack around it specifically for llama.cpp. ([GitHub][4])

One thing the repo **doesn't tell me yet is the name/specs of your newly added NUC**. `cluster.tf` reads the Proxmox node list dynamically, but that runtime output isn't stored in Git. So I'll call it `<new-nuc-node>` in the plan until we use its real Proxmox hostname. ([GitHub][5])

# Proposed target

I'd make the new service:

```text
                        LAN
                         │
                         │ http://192.168.1.x:8080
                         ▼
                  llama-api-01
                  Proxmox VM
                         │
                ┌────────┴────────┐
                │     Debian      │
                │     Docker      │
                │                │
                │ llama.cpp      │
                │ :8080          │
                │                │
                │ /models        │
                └────────────────┘
                         │
                  OpenAI-compatible
                       API
```

And in Git:

```text
homelab/
├── llama-api/
│   ├── compose.yml
│   └── model.env.example
│
├── terraform/
│   └── llama-api.tf
│
├── ansible/
│   ├── inventory/
│   │   └── llama-api.ini
│   └── playbooks/
│       └── deploy-llama-api.yml
│
└── Jenkinsfile
```

The official llama.cpp project provides a dedicated `ghcr.io/ggml-org/llama.cpp:server` image, supports amd64, and documents mounting a model directory and publishing the server on port 8080. Intel/Vulkan server images are also available later if we decide to accelerate it. ([GitHub][6])

## Implementation plan

1. **Prepare the new NUC as a Terraform target.** First confirm `<new-nuc-node>` is online in the same Proxmox cluster, has `vmbr0`, appropriate local VM storage, and can receive a full clone from template VM `100` on `pve-infra-02`. The important CI/CD-specific check is your Proxmox `terraform@pve!jenkins` permissions: because your permissions are scoped by node/storage/SDN in addition to the `ci-cd` pool, the new node probably needs the same Terraform ACL treatment you gave the previous target nodes. This is Proxmox-side state and isn't represented by the Git repo, so we'd verify it before touching Terraform.

2. **Choose the VM identity and resources.** I'd use `llama-api-01` as both service and VM naming, with a new VM ID such as `9120` if it's actually free, and reserve an unused LAN address such as `192.168.1.130/24` only after checking UniFi/Proxmox. Unlike your 1-core/1-GB web VMs, this VM should receive most of the NUC resources you intend to dedicate to inference. I would also use CPU type `host` so the VM sees the NUC's CPU capabilities. Exact cores, RAM, and model disk size should be based on the NUC hardware and GGUF we're going to run rather than guessed now.

3. **Create `terraform/llama-api.tf`.** This should closely copy `personal-web-app.tf`: target `<new-nuc-node>`, clone VM `100` from `var.template_node`, use the `ci-cd` pool, configure `vmbr0`, create the existing `deployer` account with `keys/ci-ansible.pub`, and assign the reserved LAN IP. ([GitHub][7]) I would give model storage special attention here. A llama model can easily dwarf your web application disks, so either enlarge the VM disk or attach a separate model disk rather than assuming the Debian template's existing disk is sufficient.

4. **Create `llama-api/compose.yml`.** Start CPU-only with `ghcr.io/ggml-org/llama.cpp:server`. Publish `8080:8080`, mount `/srv/llama-models:/models`, listen on `0.0.0.0`, and point `-m` at the chosen `.gguf`. That makes the API directly available to machines on your `192.168.1.0/24` LAN without exposing anything through the UDM to the Internet. The server provides `/v1/chat/completions` and other OpenAI-compatible endpoints. ([GitHub][8])

5. **Keep models outside Git.** I would not commit `.gguf` files. For the first iteration, keep the model under `/srv/llama-models` on the VM. We have two reasonable first-build approaches: manually seed the chosen model once, or have Ansible download a pinned model URL with a checksum only when it isn't already present. I slightly prefer the latter because a rebuilt VM stays reproducible, but we shouldn't make every application deployment redownload ten or twenty gigabytes. Model identity belongs in configuration; model bytes do not belong in Git.

6. **Create `deploy-llama-api.yml`.** This can reuse much of your current Ansible pattern: DNS setup, install Docker/Compose, enable Docker, create directories, copy Compose configuration, then run `community.docker.docker_compose_v2`. Your current playbooks already implement exactly this lifecycle. ([GitHub][9]) For llama I'd create `/opt/llama-api` for Compose/configuration and `/srv/llama-models` for large persistent model files.

7. **Handle the API key differently from application files.** Your repo globally ignores `.env`, which is good for secrets. ([GitHub][10]) I would create a Jenkins Secret Text credential such as `llama-api-key`, have Jenkins pass it to the Ansible deployment, and have Ansible write a root-readable environment file on `llama-api-01`. Nothing secret goes into `compose.yml`, Terraform, Git, or the Ansible inventory.

8. **Improve Jenkins before registering llama-api.** This is the one pipeline refactor I'd make now. Change the service definition from an implicit `/` health check to something like `healthPath: '/health'`, and make `healthCheck()` retry until success or timeout. llama.cpp explicitly returns `503` while loading and `200` when ready, so Jenkins can reliably wait for the model instead of arbitrarily sleeping. ([GitHub][11]) Existing nginx services can simply use `healthPath: '/'`, so the improvement remains generic.

9. **Also fix service change detection while we're there.** Currently, editing `ansible/playbooks/deploy-llama-api.yml` or `terraform/llama-api.tf` alone would not trigger llama's Ansible deployment because Jenkins only checks the application root directory. Your own service documentation calls out this limitation. ([github.com][1]) I'd replace `rootFolderName` with or augment it using `watchPaths`, for example `llama-api/`, `ansible/playbooks/deploy-llama-api.yml`, `ansible/inventory/llama-api.ini`, and `terraform/llama-api.tf`. We can retroactively give the other services the same behavior.

10. **Deploy in two milestones.** First prove `Terraform → VM → SSH → Docker → llama-server → /health` with a small public GGUF. Then switch to the actual local model and benchmark it. Only after CPU inference is stable would I touch Intel iGPU/Vulkan/SYCL/OpenVINO passthrough. The official images already include `server-intel` and `server-vulkan`, and llama.cpp also documents Intel GPU operation through OpenVINO, so that becomes an optimization project rather than a prerequisite for getting the API working. ([GitHub][6])

## What Jenkins should look like afterward

```text
Git push
   │
   ▼
Checkout
   │
   ▼
Terraform fmt / init / validate
   │
   ▼
Terraform plan
   │
   ▼
Terraform apply
   │
   ▼
Detect changed service
   │
   └── llama-api selected
           │
           ▼
       Wait for SSH
           │
           ▼
         Ansible
           │
           ├── Docker
           ├── model directory
           ├── API secret
           └── Compose
           │
           ▼
        llama-server
           │
           ▼
  retry GET /health
     503 → wait
     503 → wait
     200 → continue
           │
           ▼
POST /v1/chat/completions
           │
           ▼
        SUCCESS
```

I would actually add that final `/v1/chat/completions` request too. `/health` proves the model loaded; a tiny completion request proves the **actual inference API** works.

### The first concrete milestone

The cleanest first chunk is **Proxmox/Terraform only**: identify the new NUC's Proxmox node name, verify the Terraform ACLs on that node, pick the VM ID/IP, and add `terraform/llama-api.tf`. Once Terraform can reliably create `llama-api-01` on the NUC and Jenkins can SSH into it, the Docker/model portion becomes straightforward.

[1]: https://github.com/Ethanb75/homelab/blob/main/ADDING_SERVICES.md "homelab/ADDING_SERVICES.md at main · Ethanb75/homelab · GitHub"
[2]: https://github.com/Ethanb75/homelab/blob/main/terraform/variables.tf "homelab/terraform/variables.tf at main · Ethanb75/homelab · GitHub"
[3]: https://github.com/Ethanb75/homelab/blob/main/Jenkinsfile "homelab/Jenkinsfile at main · Ethanb75/homelab · GitHub"
[4]: https://github.com/ggml-org/llama.cpp/blob/master/tools/server/server.cpp?utm_source=chatgpt.com "llama.cpp/tools/server/server.cpp at master · ggml-org/llama.cpp · GitHub"
[5]: https://github.com/Ethanb75/homelab/blob/main/terraform/cluster.tf "homelab/terraform/cluster.tf at main · Ethanb75/homelab · GitHub"
[6]: https://github.com/ggml-org/llama.cpp/blob/master/docs/docker.md "llama.cpp/docs/docker.md at master · ggml-org/llama.cpp · GitHub"
[7]: https://github.com/Ethanb75/homelab/blob/main/terraform/personal-web-app.tf "homelab/terraform/personal-web-app.tf at main · Ethanb75/homelab · GitHub"
[8]: https://github.com/ggml-org/llama.cpp/blob/master/README.md?utm_source=chatgpt.com "llama.cpp/README.md at master · ggml-org/llama.cpp · GitHub"
[9]: https://github.com/Ethanb75/homelab/blob/main/ansible/playbooks/deploy-personal-web-app.yml "homelab/ansible/playbooks/deploy-personal-web-app.yml at main · Ethanb75/homelab · GitHub"
[10]: https://github.com/Ethanb75/homelab/blob/main/.gitignore "homelab/.gitignore at main · Ethanb75/homelab · GitHub"
[11]: https://github.com/locht/llama.cpp/blob/master/tools/server/README.md?utm_source=chatgpt.com "llama.cpp/tools/server/README.md at master · locht/llama.cpp · GitHub"
