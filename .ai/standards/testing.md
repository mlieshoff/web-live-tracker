# Testing Standards

- Use Node.js built-ins `node:test` and `node:assert/strict`. Put tests in `test/` as `*.test.mjs`.
- Name each test in plain language that identifies the behavior and scenario. Group related assertions that verify the same outcome.
- Use `assert.equal` for simple values, `assert.deepEqual` for structured results, and `assert.throws` or `assert.rejects` for failure behavior.
- Cover relevant acceptance criteria, boundaries, invalid inputs, and failure paths. Add regression tests for reproducible defects when practical.
- Keep tests deterministic. Use synthetic inputs and lightweight fakes at browser or external boundaries where practical.
- Do not add testing dependencies without approval or weaken existing tests to make them pass.

## Verification

- Run the full suite from the repository root with `node --test`, as CI does. For focused iteration, run `node --test test/<name>.test.mjs` with the relevant file.
- For story releases, also run `node scripts/check-extension-version.mjs HEAD origin/main` after committing the version files and refreshing the base reference.
- Record the exact commands, results, and any testing limitations. QA checks acceptance criteria, meaningful assertions, regression coverage, and the full suite result before marking the story PASSED.
