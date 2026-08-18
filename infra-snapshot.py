#!/usr/bin/env python3
"""
homelab-snapshot.py

Collect a model-friendly snapshot of a Proxmox VE cluster from a Proxmox node.
Designed to be run as root on the Dell R240 (or any PVE cluster node).

Outputs:
  - homelab.json   normalized machine-readable inventory
  - homelab.md     readable/model-friendly summary

No third-party Python packages are required.
"""

from __future__ import annotations

import argparse
import datetime as dt
import ipaddress
import json
import os
import re
import shutil
import socket
import subprocess
import sys
from pathlib import Path
from typing import Any


DEFAULT_OUTPUT_DIR = "/var/lib/homelab-inventory"

# Fields whose values should never be exported verbatim.
SECRET_KEY_RE = re.compile(
    r"(password|passwd|secret|token|private.?key|api.?key|auth.?key|"
    r"ticket|csrf|spice.*password)",
    re.IGNORECASE,
)

# Common VM disk/device config keys.
DISK_KEY_RE = re.compile(r"^(scsi|sata|ide|virtio)\d+$")
NET_KEY_RE = re.compile(r"^net\d+$")
MP_KEY_RE = re.compile(r"^mp\d+$")


def eprint(*args: object) -> None:
    print(*args, file=sys.stderr)


def run(cmd: list[str], timeout: int = 30) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        cmd,
        text=True,
        capture_output=True,
        timeout=timeout,
        check=False,
    )


def pvesh_get(path: str, *extra: str, timeout: int = 30) -> Any:
    """Call a Proxmox API GET through pvesh and decode JSON."""
    cmd = ["pvesh", "get", path, "--output-format", "json", *extra]
    result = run(cmd, timeout=timeout)
    if result.returncode != 0:
        msg = result.stderr.strip() or result.stdout.strip() or f"exit {result.returncode}"
        raise RuntimeError(f"{' '.join(cmd)}: {msg}")
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Invalid JSON from {' '.join(cmd)}: {exc}") from exc


def safe_pvesh(path: str, *extra: str, timeout: int = 30) -> tuple[Any | None, str | None]:
    try:
        return pvesh_get(path, *extra, timeout=timeout), None
    except Exception as exc:
        return None, str(exc)


def bytes_to_gib(value: Any) -> float | None:
    try:
        return round(int(value) / (1024**3), 2)
    except (TypeError, ValueError):
        return None


def seconds_to_human(value: Any) -> str | None:
    try:
        seconds = int(value)
    except (TypeError, ValueError):
        return None

    days, rem = divmod(seconds, 86400)
    hours, rem = divmod(rem, 3600)
    minutes, _ = divmod(rem, 60)

    chunks = []
    if days:
        chunks.append(f"{days}d")
    if hours or days:
        chunks.append(f"{hours}h")
    chunks.append(f"{minutes}m")
    return " ".join(chunks)


def parse_kv_string(value: str) -> dict[str, Any]:
    """
    Parse Proxmox comma-delimited config strings such as:
      name=eth0,bridge=vmbr0,ip=dhcp,hwaddr=AA:BB:CC:DD:EE:FF
    or:
      local-lvm:vm-100-disk-0,size=32G,ssd=1
    """
    result: dict[str, Any] = {}
    if not isinstance(value, str):
        return result

    parts = value.split(",")
    if parts and "=" not in parts[0]:
        result["volume"] = parts[0]

    for part in parts:
        if "=" in part:
            k, v = part.split("=", 1)
            result[k] = v
    return result


def clean_ip(value: str) -> str | None:
    if not value:
        return None
    value = value.split("/", 1)[0]
    try:
        ip = ipaddress.ip_address(value)
    except ValueError:
        return None
    if ip.is_loopback or ip.is_link_local:
        return None
    return str(ip)


def redact(obj: Any) -> Any:
    """Recursively redact obviously sensitive fields."""
    if isinstance(obj, dict):
        out = {}
        for key, value in obj.items():
            if SECRET_KEY_RE.search(str(key)):
                out[key] = "<redacted>"
            else:
                out[key] = redact(value)
        return out
    if isinstance(obj, list):
        return [redact(v) for v in obj]
    return obj


def normalize_guest_interfaces(raw: Any) -> list[dict[str, Any]]:
    """
    Normalize interface output from either:
      /nodes/{node}/lxc/{vmid}/interfaces
    or:
      /nodes/{node}/qemu/{vmid}/agent/network-get-interfaces
    """
    if isinstance(raw, dict) and isinstance(raw.get("result"), list):
        raw = raw["result"]

    if not isinstance(raw, list):
        return []

    interfaces = []
    for item in raw:
        if not isinstance(item, dict):
            continue

        name = (
            item.get("name")
            or item.get("interface")
            or item.get("interface-name")
            or item.get("ifname")
        )
        mac = (
            item.get("hwaddr")
            or item.get("hardware-address")
            or item.get("mac-address")
            or item.get("mac")
        )

        ipv4: list[str] = []
        ipv6: list[str] = []

        addresses = (
            item.get("ip-addresses")
            or item.get("ip-address")
            or item.get("addresses")
            or []
        )
        if isinstance(addresses, dict):
            addresses = [addresses]

        if isinstance(addresses, list):
            for addr in addresses:
                if isinstance(addr, str):
                    candidate = clean_ip(addr)
                    if candidate:
                        (ipv6 if ":" in candidate else ipv4).append(candidate)
                    continue

                if not isinstance(addr, dict):
                    continue

                raw_ip = (
                    addr.get("ip-address")
                    or addr.get("address")
                    or addr.get("ip")
                )
                candidate = clean_ip(str(raw_ip)) if raw_ip else None
                if candidate:
                    (ipv6 if ":" in candidate else ipv4).append(candidate)

        # Some LXC endpoint versions expose arrays directly.
        for key, target in (("ipv4", ipv4), ("ipv6", ipv6)):
            vals = item.get(key)
            if isinstance(vals, str):
                vals = [vals]
            if isinstance(vals, list):
                for val in vals:
                    if isinstance(val, dict):
                        val = val.get("address") or val.get("ip")
                    candidate = clean_ip(str(val)) if val else None
                    if candidate:
                        target.append(candidate)

        interfaces.append(
            {
                "name": name,
                "mac": mac,
                "ipv4": sorted(set(ipv4)),
                "ipv6": sorted(set(ipv6)),
            }
        )

    return interfaces


def configured_networks(config: dict[str, Any]) -> list[dict[str, Any]]:
    nets = []
    for key in sorted(config):
        if not NET_KEY_RE.match(key):
            continue
        raw = config[key]
        parsed = parse_kv_string(raw) if isinstance(raw, str) else {}
        nets.append(
            {
                "device": key,
                "interface": parsed.get("name"),
                "bridge": parsed.get("bridge"),
                "mac": parsed.get("hwaddr"),
                "ipv4": parsed.get("ip"),
                "ipv6": parsed.get("ip6"),
                "vlan_tag": parsed.get("tag"),
                "firewall": parsed.get("firewall"),
                "raw": raw,
            }
        )
    return nets


def configured_disks(config: dict[str, Any], guest_type: str) -> list[dict[str, Any]]:
    disks = []

    if guest_type == "lxc":
        keys = ["rootfs"] + [k for k in config if MP_KEY_RE.match(k)]
    else:
        keys = [k for k in config if DISK_KEY_RE.match(k)]

    for key in sorted(set(keys)):
        if key not in config:
            continue
        raw = config[key]
        parsed = parse_kv_string(raw) if isinstance(raw, str) else {}
        disks.append(
            {
                "device": key,
                "volume": parsed.get("volume"),
                "size": parsed.get("size"),
                "storage": (
                    parsed.get("volume", "").split(":", 1)[0]
                    if ":" in parsed.get("volume", "")
                    else None
                ),
                "raw": raw,
            }
        )
    return disks


def get_cluster_name(cluster_status: Any) -> str | None:
    if not isinstance(cluster_status, list):
        return None
    for item in cluster_status:
        if isinstance(item, dict) and item.get("type") == "cluster":
            return item.get("name")
    return None


def get_cluster_quorum(cluster_status: Any) -> dict[str, Any]:
    if not isinstance(cluster_status, list):
        return {}
    online_nodes = [
        x for x in cluster_status
        if isinstance(x, dict)
        and x.get("type") == "node"
        and x.get("online") in (1, True)
    ]
    return {
        "online_nodes": len(online_nodes),
        "nodes": [
            {
                "name": x.get("name"),
                "id": x.get("nodeid"),
                "online": bool(x.get("online")),
                "local": bool(x.get("local")),
                "ip": x.get("ip"),
            }
            for x in cluster_status
            if isinstance(x, dict) and x.get("type") == "node"
        ],
    }


def collect_node(node_name: str, resource: dict[str, Any]) -> dict[str, Any]:
    status, status_err = safe_pvesh(f"/nodes/{node_name}/status")
    network, network_err = safe_pvesh(f"/nodes/{node_name}/network")

    node = {
        "name": node_name,
        "status": resource.get("status"),
        "uptime_seconds": resource.get("uptime"),
        "uptime": seconds_to_human(resource.get("uptime")),
        "cpu_usage_fraction": resource.get("cpu"),
        "cpu_capacity": resource.get("maxcpu"),
        "memory": {
            "used_gib": bytes_to_gib(resource.get("mem")),
            "total_gib": bytes_to_gib(resource.get("maxmem")),
        },
        "disk": {
            "used_gib": bytes_to_gib(resource.get("disk")),
            "total_gib": bytes_to_gib(resource.get("maxdisk")),
        },
        "details": status or {},
        "network": network or [],
        "errors": [x for x in (status_err, network_err) if x],
    }

    # Promote a few useful node-status fields.
    if isinstance(status, dict):
        cpuinfo = status.get("cpuinfo") or {}
        if isinstance(cpuinfo, dict):
            node["cpu"] = {
                "model": cpuinfo.get("model"),
                "sockets": cpuinfo.get("sockets"),
                "cores": cpuinfo.get("cores"),
                "cpus": cpuinfo.get("cpus"),
                "mhz": cpuinfo.get("mhz"),
            }
        node["kernel_version"] = status.get("kversion")
        node["pve_version"] = status.get("pveversion")

    return node


def collect_guest(resource: dict[str, Any]) -> dict[str, Any]:
    guest_type = resource.get("type")
    node = resource.get("node")
    vmid = resource.get("vmid")

    config, config_err = safe_pvesh(f"/nodes/{node}/{guest_type}/{vmid}/config")
    config = config or {}

    observed = []
    observed_err = None

    if resource.get("status") == "running":
        if guest_type == "lxc":
            # Available in current PVE releases; gracefully falls back if the
            # cluster is on a release that does not expose this endpoint.
            raw, observed_err = safe_pvesh(
                f"/nodes/{node}/lxc/{vmid}/interfaces",
                timeout=15,
            )
            if raw is not None:
                observed = normalize_guest_interfaces(raw)

        elif guest_type == "qemu":
            # Requires QEMU Guest Agent in the guest.
            raw, observed_err = safe_pvesh(
                f"/nodes/{node}/qemu/{vmid}/agent/network-get-interfaces",
                timeout=15,
            )
            if raw is not None:
                observed = normalize_guest_interfaces(raw)

    if isinstance(config, dict):
        memory_mb = config.get("memory")
        swap_mb = config.get("swap") if guest_type == "lxc" else None
        cores = config.get("cores")
        sockets = config.get("sockets")
        vcpus = None
        try:
            if cores is not None:
                vcpus = int(cores) * int(sockets or 1)
        except (TypeError, ValueError):
            pass
    else:
        memory_mb = swap_mb = cores = sockets = vcpus = None

    guest = {
        "id": vmid,
        "type": guest_type,
        "name": resource.get("name") or config.get("hostname") or f"{guest_type}-{vmid}",
        "node": node,
        "status": resource.get("status"),
        "template": bool(resource.get("template")),
        "uptime_seconds": resource.get("uptime"),
        "uptime": seconds_to_human(resource.get("uptime")),
        "resources": {
            "vcpus": vcpus or resource.get("maxcpu"),
            "cores": cores,
            "sockets": sockets,
            "memory_mb": memory_mb,
            "memory_limit_gib": bytes_to_gib(resource.get("maxmem")),
            "memory_used_gib": bytes_to_gib(resource.get("mem")),
            "swap_mb": swap_mb,
            "disk_limit_gib": bytes_to_gib(resource.get("maxdisk")),
            "disk_used_gib": bytes_to_gib(resource.get("disk")),
        },
        "os": {
            "ostype": config.get("ostype"),
            "arch": config.get("arch"),
            "description": config.get("description"),
        },
        "configured_network": configured_networks(config) if isinstance(config, dict) else [],
        "observed_network": observed,
        "disks": configured_disks(config, guest_type) if isinstance(config, dict) else [],
        "onboot": config.get("onboot") if isinstance(config, dict) else None,
        "tags": config.get("tags") if isinstance(config, dict) else None,
        "config": config,
        "errors": [x for x in (config_err, observed_err) if x],
    }
    return redact(guest)


def collect_storage(resource: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": resource.get("storage"),
        "node": resource.get("node"),
        "type": resource.get("plugintype"),
        "status": resource.get("status"),
        "shared": bool(resource.get("shared")),
        "used_gib": bytes_to_gib(resource.get("disk")),
        "total_gib": bytes_to_gib(resource.get("maxdisk")),
        "content": resource.get("content"),
    }


def render_markdown(data: dict[str, Any]) -> str:
    lines: list[str] = []
    lines.append("# Homelab Infrastructure Snapshot")
    lines.append("")
    lines.append(f"Generated: {data['generated_at']}")
    lines.append(f"Collector host: `{data['collector']['hostname']}`")
    lines.append(f"Cluster: `{data['cluster'].get('name') or 'unknown'}`")
    lines.append("")

    lines.append("## Cluster")
    lines.append("")
    quorum = data["cluster"].get("quorum", {})
    lines.append(f"- Nodes discovered: {len(data['nodes'])}")
    lines.append(f"- Online cluster nodes: {quorum.get('online_nodes', 'unknown')}")
    lines.append(f"- Guests discovered: {len(data['guests'])}")
    lines.append(f"- Storage resources discovered: {len(data['storage'])}")
    lines.append("")

    lines.append("## Nodes")
    lines.append("")
    for node in data["nodes"]:
        lines.append(f"### {node['name']}")
        lines.append("")
        lines.append(f"- Status: **{node.get('status', 'unknown')}**")
        if node.get("pve_version"):
            lines.append(f"- Proxmox: `{node['pve_version']}`")
        if node.get("kernel_version"):
            lines.append(f"- Kernel: `{node['kernel_version']}`")
        if node.get("uptime"):
            lines.append(f"- Uptime: {node['uptime']}")
        cpu = node.get("cpu") or {}
        if cpu.get("model"):
            lines.append(f"- CPU: {cpu['model']}")
        if cpu.get("cpus") or node.get("cpu_capacity"):
            lines.append(f"- Logical CPUs: {cpu.get('cpus') or node.get('cpu_capacity')}")
        mem = node.get("memory", {})
        lines.append(
            f"- RAM: {mem.get('used_gib', '?')} GiB used / "
            f"{mem.get('total_gib', '?')} GiB available to PVE"
        )

        network = node.get("network") or []
        if network:
            lines.append("- Network:")
            for iface in network:
                if not isinstance(iface, dict):
                    continue
                name = iface.get("iface") or iface.get("name") or "?"
                typ = iface.get("type") or "interface"
                address = iface.get("address") or iface.get("cidr") or ""
                bridge_ports = iface.get("bridge_ports") or iface.get("bridge-ports") or ""
                detail = ", ".join(x for x in [typ, address, bridge_ports] if x)
                lines.append(f"  - `{name}`: {detail}")
        lines.append("")

    lines.append("## Guests")
    lines.append("")
    for guest in sorted(data["guests"], key=lambda x: int(x.get("id") or 0)):
        label = "CT" if guest["type"] == "lxc" else "VM"
        lines.append(f"### {label} {guest['id']} — {guest['name']}")
        lines.append("")
        lines.append(f"- Node: `{guest['node']}`")
        lines.append(f"- Status: **{guest['status']}**")
        r = guest["resources"]
        if r.get("vcpus") is not None:
            lines.append(f"- CPU allocation: {r['vcpus']} vCPU")
        if r.get("memory_mb") is not None:
            lines.append(f"- RAM allocation: {r['memory_mb']} MB")
        elif r.get("memory_limit_gib") is not None:
            lines.append(f"- RAM allocation: {r['memory_limit_gib']} GiB")
        if r.get("swap_mb") is not None:
            lines.append(f"- Swap: {r['swap_mb']} MB")
        if guest.get("uptime"):
            lines.append(f"- Uptime: {guest['uptime']}")
        if guest.get("onboot") is not None:
            lines.append(f"- Start on boot: {bool(guest['onboot'])}")
        if guest.get("tags"):
            lines.append(f"- Tags: `{guest['tags']}`")

        if guest["configured_network"]:
            lines.append("- Configured network:")
            for net in guest["configured_network"]:
                detail = [
                    net.get("interface") or net.get("device"),
                    f"bridge={net['bridge']}" if net.get("bridge") else None,
                    f"ipv4={net['ipv4']}" if net.get("ipv4") else None,
                    f"vlan={net['vlan_tag']}" if net.get("vlan_tag") else None,
                    f"mac={net['mac']}" if net.get("mac") else None,
                ]
                lines.append("  - " + ", ".join(x for x in detail if x))

        if guest["observed_network"]:
            lines.append("- Observed network:")
            for net in guest["observed_network"]:
                addrs = (net.get("ipv4") or []) + (net.get("ipv6") or [])
                if addrs:
                    lines.append(
                        f"  - `{net.get('name') or '?'}`: " + ", ".join(addrs)
                    )

        if guest["disks"]:
            lines.append("- Disks:")
            for disk in guest["disks"]:
                desc = disk.get("volume") or disk.get("raw") or "?"
                if disk.get("size"):
                    desc += f" ({disk['size']})"
                lines.append(f"  - `{disk['device']}`: {desc}")

        if guest["errors"]:
            # Keep this concise. Missing QEMU agent is common and non-fatal.
            lines.append("- Collection notes:")
            for err in guest["errors"]:
                lines.append(f"  - {err}")
        lines.append("")

    lines.append("## Storage")
    lines.append("")
    for st in data["storage"]:
        lines.append(
            f"- `{st.get('id')}` on `{st.get('node')}` "
            f"({st.get('type') or 'unknown'}): "
            f"{st.get('used_gib', '?')} / {st.get('total_gib', '?')} GiB, "
            f"status={st.get('status')}"
        )
    lines.append("")

    if data.get("collection_errors"):
        lines.append("## Collection Errors")
        lines.append("")
        for err in data["collection_errors"]:
            lines.append(f"- {err}")
        lines.append("")

    lines.append("## Notes for Models")
    lines.append("")
    lines.append(
        "This file describes observed Proxmox state at the generation time. "
        "Treat it as a point-in-time inventory, not desired-state configuration."
    )
    lines.append(
        "Configured guest addresses and observed guest addresses may differ, "
        "especially when DHCP is used. Observed VM addresses depend on the QEMU Guest Agent."
    )
    lines.append("")

    return "\n".join(lines)


def collect() -> dict[str, Any]:
    if os.geteuid() != 0:
        raise SystemExit("Run this script as root on a Proxmox VE node.")

    if not shutil.which("pvesh"):
        raise SystemExit("pvesh was not found. Run this on a Proxmox VE node.")

    errors: list[str] = []

    cluster_status, err = safe_pvesh("/cluster/status")
    if err:
        errors.append(err)
        cluster_status = []

    resources, err = safe_pvesh("/cluster/resources")
    if err:
        raise SystemExit(f"Unable to read cluster resources: {err}")
    if not isinstance(resources, list):
        raise SystemExit("Unexpected response from /cluster/resources")

    node_resources = [x for x in resources if x.get("type") == "node"]
    guest_resources = [x for x in resources if x.get("type") in ("lxc", "qemu")]
    storage_resources = [x for x in resources if x.get("type") == "storage"]

    nodes = []
    for resource in sorted(node_resources, key=lambda x: x.get("node", "")):
        name = resource.get("node")
        if not name:
            continue
        eprint(f"[+] node {name}")
        nodes.append(collect_node(name, resource))

    guests = []
    for resource in sorted(guest_resources, key=lambda x: int(x.get("vmid") or 0)):
        eprint(
            f"[+] {resource.get('type')} {resource.get('vmid')} "
            f"({resource.get('name') or 'unnamed'}) on {resource.get('node')}"
        )
        guests.append(collect_guest(resource))

    storage = [
        collect_storage(x)
        for x in sorted(
            storage_resources,
            key=lambda x: (x.get("node", ""), x.get("storage", "")),
        )
    ]

    data = {
        "schema_version": 1,
        "generated_at": dt.datetime.now().astimezone().isoformat(timespec="seconds"),
        "collector": {
            "hostname": socket.gethostname(),
            "script": "homelab-snapshot.py",
        },
        "cluster": {
            "name": get_cluster_name(cluster_status),
            "quorum": get_cluster_quorum(cluster_status),
        },
        "nodes": nodes,
        "guests": guests,
        "storage": storage,
        "collection_errors": errors,
    }

    return redact(data)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Create a model-friendly Proxmox homelab inventory snapshot."
    )
    parser.add_argument(
        "-o",
        "--output-dir",
        default=DEFAULT_OUTPUT_DIR,
        help=f"Output directory (default: {DEFAULT_OUTPUT_DIR})",
    )
    parser.add_argument(
        "--stdout",
        choices=("json", "markdown"),
        help="Also print the selected representation to stdout.",
    )
    args = parser.parse_args()

    data = collect()

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    json_path = output_dir / "homelab.json"
    md_path = output_dir / "homelab.md"

    json_path.write_text(
        json.dumps(data, indent=2, sort_keys=False) + "\n",
        encoding="utf-8",
    )
    markdown = render_markdown(data)
    md_path.write_text(markdown, encoding="utf-8")

    print(f"Snapshot written:")
    print(f"  {json_path}")
    print(f"  {md_path}")

    if args.stdout == "json":
        print(json.dumps(data, indent=2))
    elif args.stdout == "markdown":
        print(markdown)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())