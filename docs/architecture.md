# Fleet-Pi Architecture

```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#e1f5fe', 'primaryTextColor': '#01579b', 'primaryBorderColor': '#0288d1', 'lineColor': '#0288d1', 'secondaryColor': '#fff3e0', 'tertiaryColor': '#e8f5e9'}}}%%
graph TD
    subgraph Client["Browser Client"]
        React[React 19 + TanStack Router]
        AgentChat[AgentChat Component]
        InputBar[InputBar Component]
        MessageList[MessageList Component]
    end

    subgraph WebApp["apps/web — TanStack Start"]
        Vite[Vite Dev Server]
        API[API Routes]
        ChatRoute[/api/chat]
        HealthRoute[/api/health]
        ModelsRoute[/api/chat/models]
        ResourcesRoute[/api/chat/resources]
        SessionRoute[/api/chat/session]
        PiServer[Pi Server Module]
        PlanMode[Plan Mode Extension]
        CircuitBreaker[Circuit Breaker]
        Logger[Pino Logger]
        Sanitizer[PII Sanitizer]
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
    React --> Vite
    Vite --> API
    API --> ChatRoute
    API --> HealthRoute
    API --> ModelsRoute
    API --> ResourcesRoute
    API --> SessionRoute
    ChatRoute --> PiServer
    ChatRoute --> Sanitizer
    ChatRoute --> Logger
    PiServer --> CircuitBreaker
    CircuitBreaker --> Bedrock
    PiServer --> PlanMode
    AgentChat --> AgentElements
    AgentElements --> Shadcn
    AgentElements --> Styles
    InputBar --> AgentElements
    MessageList --> AgentElements
```
