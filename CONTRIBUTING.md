# Contributing

Thank you for your interest in contributing to recmp3-cli.

## Reporting bugs

Open a GitHub Issue using the bug report template. Include:
- OS and version
- Node.js version (`node --version`)
- ffmpeg version (`ffmpeg -version | head -1`)
- Steps to reproduce
- Expected vs actual behavior
- Output of `recmp3 doctor`

## Suggesting features

Open a GitHub Issue using the feature request template. Describe the use case, not just the solution.

## Submitting code

1. Fork the repository
2. Create a branch: `git checkout -b feat/your-feature-name`
3. Make your changes
4. Run all checks:
   ```bash
   npm run typecheck
   npm run lint
   npm run build
   ```
5. Open a pull request against `main`

## Development setup

```bash
git clone https://github.com/aedneth/recmp3-cli
cd recmp3-cli
npm install
npm run dev        # Run without building (tsx)
npm run build      # Build to dist/
npm run typecheck  # TypeScript check
npm run lint       # Biome lint
```

**Requirements:** Node.js ≥ 20, ffmpeg ≥ 4.4, a Groq API key (`GROQ_API_KEY` env var).

## Code style

This project uses [Biome](https://biomejs.dev/) for formatting and linting. Run `npm run lint` before submitting. The CI will reject PRs that don't pass.

## License

By contributing, you agree that your contributions will be licensed under [AGPL-3.0](LICENSE).
