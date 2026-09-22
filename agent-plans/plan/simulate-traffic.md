Absolutely. This is essentially **load testing / stress testing / performance engineering**, and there are mature tools specifically for generating synthetic users at very large scale.

For the kinds of systems you've been building—Node/TypeScript, Postgres, Redis, Socket.IO, containers—I’d focus on **k6 and Artillery**.

### The main tools

| Tool                    | Test language           | Best for                                       | Distributed load       |
| ----------------------- | ----------------------- | ---------------------------------------------- | ---------------------- |
| **k6**                  | JavaScript              | HTTP APIs, WebSockets, performance engineering | Yes                    |
| **Artillery**           | JS/TS/YAML              | Node apps, APIs, WebSockets, **Socket.IO**     | Yes                    |
| **Locust**              | Python                  | Complex simulated user behavior                | Yes                    |
| **Gatling**             | Java/Scala/Kotlin/JS/TS | Extremely high-throughput load testing         | Yes                    |
| **JMeter**              | GUI/XML/Java            | Traditional enterprise testing                 | Yes                    |
| **wrk / wrk2 / vegeta** | CLI                     | Raw HTTP benchmarking                          | Usually single-machine |

Locust, for example, explicitly supports master/worker distributed testing across multiple machines and can run thousands or tens of thousands of simulated users per worker depending on workload. ([Locust Documentation][1]) Gatling similarly uses an asynchronous architecture designed to represent thousands of virtual users efficiently. ([Gatling documentation][2])

## I think Artillery would be especially interesting for you

Artillery fits your stack extremely well because it uses JavaScript/TypeScript and supports HTTP, browsers, WebSockets, and distributed testing. ([Artillery][3])

More importantly, **it has built-in Socket.IO support**. ([Artillery][4])

You could simulate something like:

```text
                     LOAD GENERATORS

       Artillery #1        Artillery #2        Artillery #3
        20k users           20k users           20k users
             \                  |                  /
              \                 |                 /
               └───────────────▼─────────────────┘

                           Internet
                              │
                              ▼
                     ┌─────────────────┐
                     │ Load Balancer   │
                     └────────┬────────┘
                              │
                ┌─────────────┼─────────────┐
                ▼             ▼             ▼
             Node #1       Node #2       Node #3
                │             │             │
                └─────────────┼─────────────┘
                              │
                 ┌────────────┴─────────────┐
                 ▼                          ▼
              Redis                      Postgres
                 │                          │
                 └────────────┬─────────────┘
                              ▼
                    Metrics / Tracing
```

And now you've created your own little performance-engineering laboratory.

## What makes this really useful

Don't just test:

> "Can my API handle 10,000 users?"

Build experiments around **where the architecture breaks**.

For example:

```text
100 users
   ↓
1,000
   ↓
5,000
   ↓
10,000
   ↓
25,000
   ↓
50,000
```

While monitoring:

```text
p50 latency
p95 latency
p99 latency

requests/sec
errors/sec

Node CPU
Node memory
event-loop lag

Postgres CPU
Postgres connections
query latency
locks
buffer-cache hit ratio

Redis CPU
Redis memory
commands/sec

network throughput

load balancer connections

WebSocket connections
WebSocket messages/sec
```

Eventually you'll see something like:

```text
users      RPS       p95        errors
----------------------------------------
1k         800       32 ms      0%
5k         3900      51 ms      0%
10k        7600      94 ms      0.1%
20k        12000     310 ms     1.2%
30k        12500     1.8 sec    14%
40k        12300     5.2 sec    37%
```

That plateau around **12,500 RPS** tells you you've hit a bottleneck.

Then the fun part is figuring out **why**.

---

## You can test architecture changes scientifically

Suppose your initial architecture is:

```text
Load Balancer
     │
     ▼
Node
     │
     ▼
Postgres
```

It fails around 5,000 RPS.

Add horizontal scaling:

```text
             ┌── Node
LB ──────────┼── Node
             └── Node
                 │
              Postgres
```

Now maybe you reach 12,000 RPS.

But Postgres becomes the bottleneck.

Add Redis:

```text
             ┌── Node ──┐
LB ──────────┼── Node ──┼── Redis
             └── Node ──┘
                  │
               Postgres
```

Maybe you're now at:

```text
30,000 RPS
```

Then experiment with:

* connection pooling
* PgBouncer
* read replicas
* partitioning
* caching
* async queues
* batching
* indexes
* CDN caching
* application-level sharding
* database sharding

Every architecture decision becomes measurable.

---

# k6 is another excellent choice

k6 is probably the load-testing tool I'd learn **alongside Artillery**.

A simple test looks roughly like:

```javascript
import http from "k6/http";
import { sleep } from "k6";

export const options = {
  vus: 10000,
  duration: "5m",
};

export default function () {
  http.get("https://my-test-app/api/products");

  sleep(1);
}
```

That means roughly:

```text
10,000 virtual users

each repeatedly:

GET /api/products
wait
repeat
```

k6 also supports WebSocket load testing; its newer WebSocket API uses an asynchronous global event loop. ([Grafana Labs][5])

More realistic tests might simulate:

```text
User starts session
       │
       ▼
GET /
       │
       ▼
POST /login
       │
       ▼
GET /products
       │
       ▼
GET /products/283
       │
       ▼
POST /cart
       │
       ▼
POST /checkout
```

Instead of just hammering one endpoint.

---

# One important concept: users ≠ RPS

This becomes extremely important.

Suppose you have:

```text
100,000 connected users
```

They might only generate:

```text
5,000 requests/sec
```

because humans spend most of their time **not making requests**.

Locust's documentation makes this distinction explicitly: virtual users can number in the thousands or tens of thousands per process while actual request throughput remains the limiting factor. ([Locust Documentation][1])

For a chat application, you might have:

```text
100,000 WebSocket connections

but only

2,000 messages/sec
```

That's a completely different test from:

```text
100,000 HTTP requests/sec
```

And each exposes different architectural problems.

---

# You can also simulate traffic patterns

This is more interesting than simply saying "run 10,000 users."

### Ramp test

```text
users

50k |                         ███
    |                     ███████
25k |                ████████████
    |           █████████████████
 0  |████████████████████████████
    +-----------------------------
          time
```

Find where performance degrades.

### Spike test

Ticket-sale / viral-event scenario:

```text
500 users
500 users
500 users
50,000 users
50,000 users
500 users
```

Tests autoscaling.

### Soak test

Run:

```text
5,000 users
for
24 hours
```

Look for:

* memory leaks
* connection leaks
* DB bloat
* queue accumulation
* GC problems
* file descriptor leaks

### Failure test

While load is running:

```text
kill Node #2
```

or:

```text
restart Redis
```

or:

```text
kill a Postgres replica
```

Now you're getting into **chaos engineering**.

---

# Then combine load testing with observability

This is where the exercise becomes enormously educational.

I would build a little monitoring stack:

```text
                    ┌──────────────┐
                    │   Grafana    │
                    └──────▲───────┘
                           │
              ┌────────────┴────────────┐
              │                         │
        Prometheus                  Tempo
         metrics                    traces

              ▲                         ▲
              │                         │

           Node API ───── OpenTelemetry
              │
              ▼
           Postgres
              │
              ▼
            Redis
```

During the test you could literally watch:

```text
RPS                ↑↑↑↑
Node CPU           ↑↑
Postgres CPU       ↑↑↑↑↑
DB connections     █████████ max
p95 latency        ↑↑↑↑↑↑↑↑
```

And suddenly:

> "The system is slow."

becomes:

> "At ~13,500 RPS our Postgres pool reaches 200 connections, query wait time increases, Node requests queue behind DB acquisition, and p95 latency jumps from 90ms to 800ms."

That's real performance engineering.

---

# Your homelab could actually be perfect for this

One especially fun project would be turning your Proxmox environment into a **miniature distributed-system laboratory**.

Something like:

```text
Proxmox Cluster

VM 1
Load generator

VM 2
Load generator

VM 3
HAProxy / nginx

VM 4
Node API

VM 5
Node API

VM 6
Node API

VM 7
Postgres primary

VM 8
Postgres replica

VM 9
Redis

VM 10
Prometheus + Grafana
```

Then intentionally impose limitations:

```text
Node VM
2 CPU
2 GB RAM

Postgres
4 CPU
8 GB RAM

Redis
1 CPU
1 GB RAM
```

Now you're forced to solve real scaling problems rather than just throwing hardware at them.

---

## A project I'd recommend for you

Build a fake **high-volume logistics marketplace** since you already understand that domain.

Entities:

```text
users
carriers
loads
trucks
quotes
bookings
messages
locations
```

Services:

```text
                   API Gateway
                        │
         ┌──────────────┼──────────────┐
         ▼              ▼              ▼
    Load Service   Quote Service   User Service
         │              │              │
         └──────────────┼──────────────┘
                        ▼
                    Postgres
                        │
                       CDC
                        │
                        ▼
                       Kafka
                    /    |    \
                   ▼     ▼     ▼
              Search  Analytics Notifications

                   Redis Cache
                       │
                    WebSocket
                       │
                   Live updates
```

Then simulate:

```text
100,000 carriers online
20,000 shippers online

10k load searches/sec
2k quotes/sec
500 bookings/sec
50k WebSocket messages/sec
```

Those can be **synthetic targets** rather than claims about real-world volumes.

Now you'd get hands-on experience with:

* horizontal scaling
* eventual consistency
* cache invalidation
* message queues
* backpressure
* database contention
* connection pools
* hot keys
* partitioning
* rate limiting
* distributed tracing
* autoscaling
* failover
* idempotency
* retry storms
* thundering herd problems

That is much closer to how you learn large-scale architecture than just reading system-design books.

For **your stack**, I'd start with **Artillery + Prometheus + Grafana + OpenTelemetry**, then add k6 as you get deeper into performance testing. Artillery's TypeScript/JavaScript orientation and first-class Socket.IO support make it particularly convenient for the real-time Node systems you've been experimenting with. ([Artillery][3])

One caveat: generate this kind of traffic only against systems you own or have explicit authorization to test. At sufficient scale, a load test is functionally indistinguishable from a denial-of-service attack to the target infrastructure.

[1]: https://docs.locust.io/en/stable/running-distributed.html?utm_source=chatgpt.com "Distributed load generation — Locust 2.46.6 documentation"
[2]: https://docs.gatling.io/?utm_source=chatgpt.com "Gatling documentation"
[3]: https://www.artillery.io/docs/get-started/load-testing?utm_source=chatgpt.com "Load Testing · Artillery"
[4]: https://www.artillery.io/docs/reference/engines/socketio?utm_source=chatgpt.com "Socket.IO Engine · Artillery"
[5]: https://grafana.com/docs/k6/latest/using-k6/protocols/websockets/?utm_source=chatgpt.com "WebSockets | Grafana k6 documentation"
