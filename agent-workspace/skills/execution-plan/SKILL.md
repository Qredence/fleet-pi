# Execution Plan Skill

## When to use it

Use this skill for multi-step work that should be resumable, reviewable, or
shared across sessions.

## Inputs

- the user task
- relevant repository context
- constraints, risks, and validation expectations

## Outputs

- a plan file under `plans/`
- progress and decision updates as the work unfolds

## Procedure

1. Define the objective in one clear sentence.
2. Capture only the context needed to explain the task.
3. Bound the scope so the plan does not sprawl.
4. List the likely affected files or areas.
5. Break the work into ordered steps.
6. Define acceptance criteria and validation before implementation drifts.
7. Update progress and decisions as reality changes.

## Plan template

```md
# Plan Name

## Objective

## Context

## Scope

## Affected files

## Steps

## Acceptance criteria

## Validation

## Risks

## Progress log

## Decision log
```

## Quality checklist

- The plan is concrete enough to resume later.
- Scope and acceptance criteria are explicit.
- Validation matches the actual risk of the task.
- Progress reflects reality instead of the original guess.
- Decisions explain meaningful changes in direction.
