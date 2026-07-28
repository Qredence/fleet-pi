# Fleet Pi — Investor Brief

**A self-improving agent workspace. You bring the keys and the sandbox. The agent builds the rest.**

---

## One-liner

Fleet Pi is an open-source platform that lets developers run a self-improving AI coding agent on their own infrastructure — their own LLM keys, their own sandbox, their own Git repo. The agent grows its own skills, memory, and tools over time, adapting to the user's workflow without vendor lock-in.

---

## The problem

Current AI coding agents fall into two camps:

**SaaS lock-in** (GitHub Copilot, Cursor, Cody): Your agent lives in their cloud. Memory, skills, and configuration are proprietary. You can't audit what the agent did, you can't customize its behavior deeply, and you can't take your setup to another tool.

**DIY complexity** (LangChain, CrewAI, AutoGPT): You get a framework, not a working system. You need to wire up the agent loop, the tool sandbox, the memory system, the chat UI, the auth layer — and maintain it all yourself. Most developers don't have the time or expertise.

The market is caught between "it works but you don't own it" and "you own it but it doesn't work."

---

## The solution

Fleet Pi is a **meta-harness** — a complete, self-hosted agent workspace that ships as a working system and grows with the user.

**Core innovation:** The agent is simultaneously the worker and the architect of its own environment. It writes its own skills, registers its own prompts, evaluates its own output, and adapts to the user over time. Two users with Fleet Pi will have completely different systems after a few sessions — because the system _became_ what they needed it to be.

**Key differentiators:**

| Dimension         | Competitors                                   | Fleet Pi                                                    |
| ----------------- | --------------------------------------------- | ----------------------------------------------------------- |
| **Ownership**     | Your data, your config lives on their servers | Everything in your Git repo, your cloud, your keys          |
| **Adaptation**    | Fixed feature set, vendor roadmap             | Self-improving: agent creates its own skills and tools      |
| **Auditability**  | Opaque logs, no diff                          | Full Git-native provenance: every file change is reviewable |
| **Isolation**     | Shared tenants, no per-user sandboxing        | Per-user Daytona sandboxes with durable volumes             |
| **Extensibility** | Plugin API limited to what vendor exposes     | Full TypeScript extension system, 5,300+ community packages |
| **Cost**          | Per-seat subscription + usage fees            | Your own LLM keys, your own compute, no per-seat markup     |

---

## Market

The AI coding agent market is projected to grow from ~$1B (2024) to ~$15B+ by 2030. Key tailwinds:

- **Developer adoption of AI coding tools** hit 80%+ in 2025 surveys, up from 40% in 2023
- **Enterprise demand for self-hosted AI** is accelerating as companies refuse to send proprietary code to third-party APIs
- **The "BYOK" (bring your own key) model** is becoming standard — every major cloud provider now offers LLM access through API keys
- **Pi** (the agent framework Fleet Pi is built on) has 77,000+ GitHub stars, 9,500+ forks, and 5,300+ community packages — a thriving ecosystem

Fleet Pi sits at the intersection of three growing markets: AI coding assistants, developer tooling, and self-hosted infrastructure.

---

## Business model

Fleet Pi is open-source (Apache 2.0). The business model is still being defined, but viable paths include:

1. **Managed hosting** — Deploy and manage Fleet Pi for enterprises that don't want to self-host
2. **Enterprise features** — SSO, audit logging, team management, compliance reports
3. **Daytona sandbox credits** — Bundled sandbox compute for users who don't have their own
4. **Professional services** — Custom workspace seeds, training, integration support

---

## Traction

- Live deployment at [fleet-pi-web.vercel.app](https://fleet-pi-web.vercel.app/)
- Fully functional chat with Agent and Plan modes
- Pi SDK integration at v0.80.10 with active upstream development
- Neon Postgres integration for session mirroring and settings persistence
- Daytona sandbox integration for per-user isolated execution
- Proven self-improvement: the agent has already created prompts, extensions, evals, plans, and research that weren't in the original seed

---

## The team

Fleet Pi is built by **Qredence**, a company building infrastructure for agentic systems. The project is led by a single developer with deep experience in the Pi ecosystem and a clear vision for self-improving agent workspaces.

---

## Ask

Seed funding to:

- Expand the team to accelerate development
- Build the managed hosting platform
- Develop the enterprise feature set
- Grow the community and ecosystem

For more details: [Qredence/fleet-pi](https://github.com/Qredence/fleet-pi)
