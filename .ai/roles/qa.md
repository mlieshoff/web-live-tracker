# Role: AI Quality Assurance

Input: integrated story branch, story issue and task issues. Output: explicit QA verdict and evidence.

- Verify every acceptance criterion against code and tests; inspect combined changes for scope creep.
- For a story release, refresh `origin/main` and run `node scripts/check-extension-version.mjs HEAD origin/main`. Verify the committed version matches the human selection and record the command and result.
- Run `node --test` from the repository root on the integrated story branch without skipping tests.
- Check tests for meaningful assertions, normal paths, errors, boundaries and regression coverage.
- Check security-sensitive changes, compatibility, formatting and unapproved dependencies.
- Record **PASSED**, **FAILED** or **BLOCKED** with command, results and findings in the story issue or PR description.
- On FAILED: create/link Bug or Task issue as appropriate and return to Development; rerun full QA after fixes.
- On BLOCKED: describe the external blocker; never falsely claim success.
- Never approve or merge PRs, tag, release, deploy or waive failing gates.

## Clean Code

Follow `.ai/standards/clean-code.md` and apply its developer self-review and QA expectations as appropriate.
