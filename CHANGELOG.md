# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [0.0.5] - 2026-10-28

### Added
- "Add Scene", "Add Game Object" and "Add Component" now appear when right-clicking the `scenes`, `gameObjects` and `components` folders.
- New-file contents are read from editable templates in `file-templates/`.

### Changed
- Minor update to the `top-down` template's `SquareGameObject.js`.

## [0.0.4] - 2026-10-28

### Added
- New `platformer` game template with a platform game object and square controller.
- New `top-down` game template.

### Changed
- Updated the `empty` and `square` template starter files.

### Removed
- The `class` (space shooter) template.

## [0.0.3] - 2026-10-21

### Added
- New `square` game template with a square game object, controller, and main scene.

### Changed
- **Create New Game** is now available from any local folder, not only folders named `games`.
- Set the extension icon to `media/NESLego.png`.
- Simplified the `empty` template starter HTML and added normalized triangle and square assets.

### Fixed
- Added a root `jsconfig.json` so the templates' `jsconfig.json` files (which extend `../../jsconfig.json`) resolve when this repo is opened in VS Code.

## [0.0.2]

### Added
- New `empty` game template (blank `index.html`, `Assets.js`, `Globals.js`, `Settings.js`, `jsconfig.json`).
- CI workflow, ESLint, Prettier, and contribution documentation.
- Extension metadata (keywords, bugs, homepage) and workspace-trust capabilities.

### Removed
- Placeholder `a` and `b` templates.

## [0.0.1]

### Added
- **Add Scene**, **Add Game Object**, and **Add Component** commands for `.html` files.
- **Create New Game** command for folders named `games`, using bundled templates.
- **Rename** and **Delete** commands for classes, components, game objects, and scenes,
  keeping `<script src>` tags in sync.
