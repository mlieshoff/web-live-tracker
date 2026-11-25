# Code Formatting Standards

- Match the surrounding code in edited JavaScript, HTML, CSS, JSON, shell scripts, and Markdown. Follow local conventions for indentation, quotes, and line wrapping.
- Keep formatting changes within the task scope. Review the diff for unrelated edits and run `git diff --check` to catch whitespace errors.
- Use the repository's existing tooling. Get approval before introducing a formatter or dependency.
- Before PR creation, QA verifies that changed files follow local conventions and that formatting edits preserve behavior.
