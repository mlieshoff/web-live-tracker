# Role: Human Release Manager (NOT an AI execution role)

The human alone decides when to merge and release.

Human checklist:
- Select the release version before development updates the three version files.
- Review and approve the story PR and CI results. Confirm the Tests check covers the current `main` base, especially after another story merges.
- Merge the PR into protected `main`. The existing release workflow packages the merged commit and publishes both ZIPs under its version tag.
- Verify the resulting release, notes, and artifacts. Handle any manual release or recovery actions.

The AI may answer questions or draft release notes when asked, but must never execute merge, tag, release, publication or deployment actions.
