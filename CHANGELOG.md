# Changelog

## [1.1.3]
### Added
- **LaTeX Math Hardening**: Hardened the inline LaTeX math parser with backslash escape checks and spacing boundaries, preventing false-positive math renderings on currency text (like `$10 and $20`).
- **Resilient Linux Heuristics**: Added robust absolute path detection fallbacks for sandboxed Snap and Flatpak Chromium/Chrome installations.
- **Actionable Settings Link**: Built an interactive error popup during PDF export failures, offering a direct "Configure Chrome Path" button to automatically focus on the relevant user setting.
- **Premium Lightbox UI**: Redesigned the full-screen image zoom overlay with an elegant circular glassmorphic Close button (`×`) featuring scale-up and 90-degree rotate hover micro-animations.

### Fixed
- **Link Capture Bug**: Prevented images wrapped inside parent anchor links (like repository version/build badges) from being captured in the lightbox zoom listener.
- **Duplicate Tab Openings**: Delegated external HTTP/HTTPS link interactions back to VS Code's native webview handler, resolving a bug where links opened two tabs in the browser at once.

## [1.1.2]
### Changed
- **Chore**: Bumped workspace versioning metadata.

## [1.1.1]
### Refactored
- **Codebase Restructuring**: Modularized the project directory layout into distinct `markdown/`, `webview/`, and `utils/` scopes, significantly improving source maintainability.

## [1.1.0]
### Added
- **100% Offline Mode**: Bundled all core dependencies (KaTeX, Mermaid, Highlight.js, Morphdom) directly for air-gapped environment stability.
- **Interactive Checklists**: Implemented two-way task list sync enabling checkboxes in the preview to modify the markdown source code inside the active editor with full undo history.
- **Split Panel CAP-Capping**: Optimized panel columns layout to ensure previews open adjacent to markdown source files without spawning excessive columns.
- **Visual Alert Blocks**: Integrated elegant GitLab & GitHub alert callout cards for `> [!NOTE]`, `> [!WARNING]`, etc.
- **Code Block Copy Utility**: Added visual hover clipboard selectors to all code blocks with success micro-animations.
