# Desktop builds

Flipbook Studio keeps the React/Vite application as the shared core. Electron only wraps the built `dist/` directory and serves it from a loopback-only HTTP server so the existing `BrowserRouter` keeps working unchanged.

## Local development

Install the existing project dependencies first:

```bash
npm ci
```

Build the web app and open it inside Electron:

```bash
npm run desktop:dev
```

The Electron and electron-builder commands are pinned through `npx`, so the existing dependency tree and `package-lock.json` do not need desktop-only packages.

## Build installers locally

Run the command for the operating system you are currently using:

```bash
npm run desktop:win
npm run desktop:mac
npm run desktop:linux
```

Outputs are written to `release/`.

- Windows: NSIS `.exe` installer, x64
- macOS: `.dmg` for Intel x64 and Apple Silicon arm64
- Linux: `.AppImage`, x64

Cross-building macOS packages from Windows/Linux is not supported by this setup. Use the matching OS locally, or let GitHub Actions build all platforms.

## GitHub Actions release

`.github/workflows/desktop-release.yml` builds all three desktop platforms. It can be run manually to verify packages, or it runs automatically when a tag matching `v*` is pushed.

For a release:

```bash
git switch main
git pull origin main
git tag -a v0.1.0 -m "Flipbook Studio v0.1.0"
git push origin v0.1.0
```

The workflow builds Windows, macOS and Linux independently, then creates/updates the GitHub Release for that tag and attaches the generated `.exe`, `.dmg` and `.AppImage` files.

## Signing

Current CI packages are unsigned. They are suitable for internal testing, but Windows SmartScreen and macOS Gatekeeper may warn users. Production distribution should add a Windows code-signing certificate and Apple Developer signing/notarization credentials later.
