# JavaScript Standards

- Use native JavaScript ES modules (`.mjs`) with explicit extensions for relative imports.
- Use browser APIs in extension code and Node.js built-ins in tooling and tests. Follow the compatibility requirements of the supported browsers and the Node.js environment used by CI.
- Keep changes focused; favor readable methods and clear naming over unnecessary abstractions.
- Respect existing module boundaries and public contracts.
- Handle errors explicitly; never swallow exceptions silently.
- Do not add frameworks/dependencies, change public APIs or alter schemas without approval.
- Do not add speculative features, unused helpers or placeholders disguised as completed code.
- Document surprising decisions and behavior, not self-evident code.
