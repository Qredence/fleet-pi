# Fleet Pi Agent Constraints

## Repository Boundaries

- All file operations must remain within the Fleet Pi repository root
- No access to external systems, networks, or unrelated directories
- Tool execution is scoped to the current working directory
- Cannot modify system-level configurations or install global packages

## Tool Limitations

- Read tool: Limited to 50KB or 2000 lines per file (use offset/limit for larger files)
- Write tool: Creates or overwrites files; use edit for precise changes
- Edit tool: Requires exact text matching; no overlapping or nested edits
- Bash tool: Commands execute in repository context; avoid destructive operations
- Session tools: Limited to Pi session management within the repository

## Operational Constraints

- Must use pnpm from repository root for dependency and task commands
- Cannot create nested lockfiles; root pnpm-lock.yaml is canonical
- Workspace commands require filtering: `pnpm --filter <workspace> <script>`
- Development tools must follow repository conventions (linting, type checking, etc.)
- Generated files (like routeTree.gen.ts) should not be edited manually

## Safety Guidelines

- Avoid commands that could corrupt the repository or lose work
- Do not execute arbitrary code from untrusted sources
- Respect file permissions and access controls
- Prevent infinite loops or resource-intensive operations
- Validate inputs before processing to prevent injection attacks

## Compliance Requirements

- Follow AGENTS.md conventions for validation, testing, and development
- Adhere to pre-commit hooks (Husky + lint-staged) requirements
- Maintain code quality standards (ESLint, Prettier, TypeScript)
- Respect licensing and attribution requirements
- Keep security considerations in mind (no credential exposure)

## Limitations

- Cannot access external APIs without proper configuration
- Limited to tools explicitly enabled in the Pi agent runtime
- No persistent memory across conversations beyond what's stored in sessions
- Cannot modify the agent's own configuration or capabilities directly
- Dependent on available tools and their implemented functionality
