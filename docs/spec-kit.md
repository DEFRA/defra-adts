# Using GitHub Spec Kit in ADTS

This repository has Spec Kit templates and scripts under `.specify/`, Copilot
skills under `.github/skills/`, and a configured **Full SDD Cycle** workflow.
The workflow describes `specify → plan → tasks → implement`; it is an option,
not a requirement to run all four stages for every change.

## When to use it

Use Spec Kit for substantial user-facing features or changes where the team
needs to agree on behaviour, acceptance criteria, interfaces, or delivery
steps before implementation.

For a small, well-understood bug fix, dependency update, or refactor, use the
normal issue, code, and review process. Do not create a spec just to satisfy a
tool workflow.

## Recommended feature workflow

1. **Start with a ready ticket.** Confirm the user problem, acceptance
   criteria, test expectations, dependencies, and relevant non-functional
   requirements using the [Definition of Ready](definition-of-ready/README.md).
   Link existing design and service documentation rather than copying it into
   a prompt.
2. **Specify** with `speckit-specify`. Describe the user outcome, scope,
   observable acceptance criteria, and explicit exclusions. Keep the spec
   focused on behaviour; do not prescribe implementation prematurely.
3. **Review and correct `spec.md` yourself.** Resolve ambiguous requirements
   with the product/QA team before moving on. Do not send a weak draft through
   every later stage.
4. **Plan** with `speckit-plan` when the change has meaningful technical
   choices, cross-service impact, data changes, or integration concerns.
   Review the plan against the actual repository structure and existing
   patterns. For a straightforward change, agree a brief approach in the
   ticket instead of generating a full plan.
5. **Create tasks** with `speckit-tasks` when a plan needs to be divided into
   independently reviewable implementation steps. Check that every task has
   an appropriate service/path and verification step.
6. **Implement in small increments.** Use `speckit-implement` only when you
   want the assistant to execute the task list. Otherwise implement a selected
   task yourself or ask the assistant to work on that specific task. Review
   each diff and run the focused tests.
7. **Finish with the team’s Definition of Done** and link the spec/plan from
   the ticket or pull request when they add useful context.

The project skills are named `speckit-specify`, `speckit-plan`,
`speckit-tasks`, and `speckit-implement` (plus optional review skills such as
`speckit-clarify` and `speckit-analyze`). Use the corresponding skill in
Copilot; the `.specify/workflows/speckit/workflow.yml` describes the bundled
end-to-end workflow.

## Keeping AI usage focused

There is no reliable fixed token cost per Spec Kit stage: it depends on the
model, context size, and how much iteration is needed. Keep usage down by
reducing unnecessary context and rework:

- Give one bounded feature description, with the target service, behaviour,
  constraints, acceptance criteria, and out-of-scope items.
- Point to relevant files or existing docs instead of pasting large files or
  the whole repository into prompts.
- Ask for only the artifact needed next. Do not regenerate a spec, plan, or
  task list that is already accurate.
- Review each artifact before proceeding. Fix misunderstandings in the
  artifact rather than asking the model to repeat the whole workflow.
- Prefer targeted implementation requests and focused test commands over
  asking for broad repository analysis or a full test suite on every edit.
- Treat generated output as a draft. The team owns requirements, technical
  decisions, security/accessibility expectations, and code review.

Example prompt for a feature:

> Specify [user outcome] for [service/page]. Acceptance criteria: [observable
> outcomes]. Relevant context: [ticket and a few paths]. Must preserve [key
> constraints]. Out of scope: [items]. Do not design the implementation yet;
> mark genuinely unresolved requirements for team clarification.

## Current repository notes

- Copilot is the configured Spec Kit integration, and feature numbering is
  configured as sequential.
- `.specify/memory/constitution.md` is still the unfilled template. Do not
  treat its placeholders as agreed team principles; the team should ratify
  project-specific principles before relying on a constitution gate.
- Feature artifacts should live under `specs/<number>-<feature>/` and be
  committed when they are useful team records. `.specify/feature.json` is a
  machine-local pointer to the active feature, not shared feature history.
