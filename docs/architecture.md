# Fleet Pi Architecture

Generated overview of the current runtime boundaries.

Start with [docs/README.md](README.md) and [docs/quickstart.md](quickstart.md)
if you are new to Fleet Pi. This file is generated reference material.

```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#e1f5fe', 'primaryTextColor': '#01579b', 'primaryBorderColor': '#0288d1', 'lineColor': '#0288d1', 'secondaryColor': '#fff3e0', 'tertiaryColor': '#e8f5e9'}}}%%
graph TD
    subgraph Client["Browser Client"]
        React[React 19 + TanStack Router]
        AgentChat[AgentChat Component]
        InputBar[InputBar Component]
        MessageList[MessageList Component]
        RightPanels[Resources and Workspace Panels]
    end

    subgraph WebApp["apps/web — TanStack Start"]
        Vite[Vite Dev Server]
        API[API Routes]
        ChatRoute[/api/chat]
        HealthRoute[/api/health]
        ModelsRoute[/api/chat/models]
        ResourcesRoute[/api/chat/resources]
        SessionRoute[/api/chat/session]
        WorkspaceRoutes[/api/workspace/*]
        PiServer[Pi Server Module]
        PlanMode[Plan Mode Extension]
        WorkspaceServer[Workspace Server]
        ResourceCatalog[Workspace Resource Catalog]
        CircuitBreaker[Circuit Breaker]
        Logger[Pino Logger]
        Sanitizer[PII Sanitizer]
    end

    subgraph AgentWorkspace["agent-workspace"]
        Memory[Project Memory]
        Plans[Plans and Backlog]
        Skills[Skills and Evals]
        PiResources[Installed Pi Resources]
        Artifacts[Artifacts and Scratch]
    end

    subgraph ProjectPi[".pi"]
        PiConfig[settings.json]
        PiExtensions[Built-in Pi Extensions]
        PiSkills[Committed Pi Skills]
    end

    subgraph UI["packages/ui — Shared Components"]
        AgentElements[agent-elements]
        Shadcn[shadcn/ui Components]
        Styles[Tailwind CSS v4]
    end

    subgraph External["External Services"]
        Bedrock[Amazon Bedrock]
    end

    React --> AgentChat
    AgentChat --> InputBar
    AgentChat --> MessageList
    AgentChat --> RightPanels
    React --> Vite
    Vite --> API
    API --> ChatRoute
    API --> HealthRoute
    API --> ModelsRoute
    API --> ResourcesRoute
    API --> SessionRoute
    API --> WorkspaceRoutes
    ChatRoute --> PiServer
    ChatRoute --> Sanitizer
    ChatRoute --> Logger
    PiServer --> CircuitBreaker
    CircuitBreaker --> Bedrock
    PiServer --> PlanMode
    PiServer --> PiConfig
    PiServer --> PiExtensions
    PiServer --> PiSkills
    ResourcesRoute --> ResourceCatalog
    WorkspaceRoutes --> WorkspaceServer
    ResourceCatalog --> PiResources
    WorkspaceServer --> Memory
    WorkspaceServer --> Plans
    WorkspaceServer --> Skills
    WorkspaceServer --> Artifacts
    AgentChat --> AgentElements
    AgentElements --> Shadcn
    AgentElements --> Styles
    InputBar --> AgentElements
    MessageList --> AgentElements

```
