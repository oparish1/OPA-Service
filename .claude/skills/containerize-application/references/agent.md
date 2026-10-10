# Agents and Workers

Read this in addition to the language reference when the project is an AI agent, a queue consumer, a scheduled worker, or anything with a long-running loop — and above all when it executes model-chosen actions (shell commands, code, file writes, browser control, tool calls). The container is then a security boundary, not only a packaging format.

## Contents
1. Classify the agent
2. Process model and shutdown
3. Credentials and secrets
4. State and volumes
5. Network
6. Isolation when the agent executes actions
7. Health for non-HTTP processes
8. Logging and observability
9. Ask the owner

## 1. Classify the agent

From the code, decide which it is, and say so in the summary:
- **HTTP service** (an agent API, webhook receiver, chat backend): treat as an API, plus the sections below.
- **Queue or event consumer / scheduled job:** no listening port; health is a heartbeat.
- **Interactive CLI or one-shot task:** `docker run` per task; no restart policy; the entry point is the command.
- **Agent that runs tools that touch the host filesystem, spawn processes, or browse:** apply section 6 fully.

## 2. Process model and shutdown

- Run the agent process directly as the container's main process (exec-form `CMD`), or under a minimal init if it spawns subprocesses, so orphaned children are reaped and signals reach the agent.
- Verify the agent handles SIGTERM: finish or checkpoint the current step, release locks and queue messages, then exit within the stop grace period. An agent killed mid-task can leave half-written state or duplicate side effects; ask how tasks resume.
- Set a restart policy that matches the job: `unless-stopped` for a long-running worker, none for one-shot tasks. Guard against crash loops (the restart policy can hide a failing agent).

## 3. Credentials and secrets

- Model-provider keys, tool tokens, and database credentials arrive at run time through an env file kept out of the repository, orchestrator secrets, or mounted secret files. **Never bake them into `ENV`, `ARG`, or the image**, and never commit an `.env`.
- Scope credentials to the least privilege the agent needs; separate keys per environment.
- Prefer file-based secrets (`/run/secrets/...`) for anything the agent's tools could otherwise print; a tool that can run `env` can read every environment variable. Do not put secrets in the environment of a process the model can run commands in.
- Commit an `.env.example` with names only.

## 4. State and volumes

- Identify everything the agent persists: conversation or memory stores, vector indexes, caches, downloaded models, scratch workspaces, logs. Decide for each: named volume (must survive restarts), tmpfs (scratch, must not survive), or nothing.
- Give each state path a fixed location owned by the non-root user. Mount only those paths writable.
- Downloaded model weights or large assets: keep them out of the image unless they are small and versioned; mount a volume or fetch at start, and say which.
- Agents that keep memory in SQLite or local files need a volume and a plan for backup; ask the owner.

## 5. Network

- Agents usually need outbound access to model APIs and tool endpoints, and inbound access to little or nothing. Publish no ports for a non-HTTP agent.
- If the owner needs egress control, note that compose alone does not enforce it; use an egress proxy, network policy, or firewall rules, and say what is and is not in place.
- Never place model-facing tools on the same network as internal databases unless that access is intended.

## 6. Isolation when the agent executes actions

If the agent can run shell commands or code, browse, or write files at the model's direction, assume the model can be manipulated by content it reads. Bound the damage:
- Non-root user, no added capabilities: `cap_drop: [ALL]` and add back only what is proven necessary; `security_opt: [no-new-privileges:true]`.
- Read-only root filesystem (`read_only: true`) with explicit writable volumes and a `tmpfs` for `/tmp`; the agent's workspace is a dedicated writable path.
- **Never mount the Docker socket** or run `--privileged`: either gives the agent control of the host. If the agent must launch other containers, that is a different design (a separate sandboxing service) to discuss with the owner.
- Do not mount the host home directory, SSH keys, cloud credentials, or the project's own `.env` into the agent's workspace.
- CPU, memory, and process (`pids_limit`) limits so a runaway loop cannot take the host down; a time budget per task in the agent itself.
- For stronger isolation of untrusted code, recommend a separate sandbox (gVisor, a microVM, or a dedicated execution service) rather than claiming a plain container is sufficient; say what a plain container does not protect against (a shared kernel).
- Browser-automation agents need a browser with its own sandbox requirements and shared-memory sizing; check the tool's current container guidance.

## 7. Health for non-HTTP processes

A container is "healthy" only if it is doing its job, not merely running.
- Have the agent touch a heartbeat file (or update a timestamp) at the end of each loop iteration; the health check verifies the file's age is under a bound the owner chooses.
- Or expose a tiny local status endpoint. Either needs a small code change: propose it and ask.
- A queue consumer's health can also be judged by the queue system, not the container.

## 8. Logging and observability

- Log to stdout/stderr in a structured form so the runtime collects it; do not write log files inside the container without a volume and rotation.
- Log the agent's actions and tool calls without logging secrets or full sensitive payloads.
- Expose metrics or traces through whatever the project already uses; do not invent a stack.

## 9. Ask the owner

- What does the agent write, and what must survive a restart?
- What can its tools do to the filesystem, network, and other processes?
- How do tasks resume after a kill?
- Where do credentials come from in production?
- Is egress restricted, and by what?
