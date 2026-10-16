# Contributing

Thanks for your interest in improving this extension!

## Setup

```bash
npm install
npm run compile
```

## Useful commands

| Command | Purpose |
| --- | --- |
| `npm run compile` | Compile TypeScript to `out/` |
| `npm run watch` | Compile on change |
| `npm test` | Unit tests (mocha) |
| `npm run test:integration` | Integration tests in a real VS Code instance |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |
| `npm run package` | Build a `.vsix` |

## Running the extension

Press **Ctrl+F5** (Run Without Debugging) to launch an Extension Development Host.

> **F5 caveat:** On some VS Code versions (seen on 1.139 and 1.141) debugging the extension
> host with F5 fails: the new window closes, or the host reports *"Extension host did not start
> in 10 seconds"*. This is a VS Code debugger issue. Use Ctrl+F5, update VS Code, or use the
> **"Attach to Extension Host (VS Code 1.139 workaround)"** launch configuration.

## Pull requests

- Keep changes focused and add tests for new behavior.
- Make sure `npm run lint` and `npm test` pass.
- Add an entry under **Unreleased** in [CHANGELOG.md](CHANGELOG.md).
