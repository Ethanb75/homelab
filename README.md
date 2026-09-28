# Homelab

## Services

| Service            | VM ID | IP              | Port | Notes                                              |
| ------------------ | ----- | --------------- | ---- | -------------------------------------------------- |
| `personal-web-app` | 9110  | `192.168.1.128` | 8089 | nginx; proxies `/api/` to `rag-api`                |
| `qq-api`           | 9120  | `192.168.1.130` | 3000 |                                                    |
| `vector-db`        | 9130  | `192.168.1.131` | 6333 | Qdrant                                             |
| `knowledge-ingest` | 9140  | `192.168.1.132` | —    | scheduled worker, syncs the `knowledge` collection |
| `rag-api`          | 9150  | `192.168.1.133` | 8090 | RAG search and chat over the `knowledge` collection |

## Adding new services

See [ADDING_SERVICES.md](ADDING_SERVICES.md) for instructions on adding a new service.
