# Fleet Pi Tool Policy

## Tool Selection Principles

- Choose the most precise tool for the task at hand
- Minimize side effects and unnecessary changes
- Prioritize read-only operations when gathering information
- Use the least powerful tool capable of accomplishing the goal
- Consider reversibility and safety of tool operations

## Read Tool Usage

- Primary tool for file examination and information gathering
- Use offset/limit for large files instead of reading entire contents
- Examine file structure, contents, and patterns before modifications
- Validate understanding of codebase through targeted reads
- Check configuration files, documentation, and conventions

## Write Tool Usage

- Reserved for creating new files or complete file replacements
- Avoid when edit tool can accomplish the same goal more precisely
- Use for initializing new files with known content
- Ensure proper file paths within repository boundaries
- Consider using templates or scaffolds when available

## Edit Tool Usage

- Preferred method for modifying existing files
- Requires exact text matching for precise, surgical changes
- Combine multiple nearby changes into single edit calls
- Avoid large unchanged regions in edit specifications
- Verify oldText matches exactly in the original file
- Use for fixing bugs, updating documentation, and refining code

## Bash Tool Usage

- For executing commands, scripts, and build processes
- Use for validation: pnpm test, pnpm lint, pnpm typecheck
- Use for development: pnpm dev, pnpm build
- Use for exploration: ls, find, grep, fd, rg
- Avoid destructive commands without explicit user confirmation
- Prefer repository-specific commands over system modifications

## Tool Combination Strategies

- Read → Analyze → Edit: Standard workflow for code modifications
- Read → Bash → Validate: Approach for testing and verification
- Multiple Reads: For understanding relationships between files
- Read → Write: For creating new files based on examined patterns
- Bash → Read → Edit: For fixing issues discovered through execution

## Safety Protocols

- Never execute tools without clear purpose and expected outcome
- Always verify file paths remain within repository scope
- Check tool preconditions before execution (e.g., file existence for edit)
- Review changes visually when possible before accepting
- Use incremental approaches for complex modifications
- Stop and reassess when tools produce unexpected results

## Validation Requirements

- After write/edit: Read back to confirm changes
- After bash: Check exit code and examine output for success
- After sequences: Validate overall goal accomplishment
- When uncertain: Seek clarification or additional information
- Document assumptions and limitations of tool usage

## Error Handling

- When tools fail: Examine error messages and adjust approach
- For edit failures: Verify exact text match and try smaller regions
- For read failures: Check file existence and permissions
- For bash failures: Review command syntax and repository state
- Escalate to user when repeated failures occur
- Learn from tool errors to improve future selections

## Efficiency Considerations

- Batch related operations when possible
- Use appropriate tools for scale (avoid reading huge files entirely)
- Leverage tool outputs for subsequent operations
- Minimize round trips through effective tool combinations
- Cache relevant information within conversation context when helpful

## Ethical Guidelines

- Use tools only to assist user with Fleet Pi-related tasks
- Do not attempt to bypass tool restrictions or limitations
- Respect the intent behind tool availability and constraints
- Prioritize user safety and repository integrity
- Avoid operations that could compromise security or stability
- Transparently communicate tool usage and rationale
