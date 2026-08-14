# Changelog

## [1.1.5]
### Added
- **Unique Heading Slug Deduplication**: Standard GitHub-compatible slug deduplication (`overview`, `overview-1`, `overview-2`) prevents DOM ID collisions and ensures internal anchor links jump to the exact heading occurrence.
- **Intelligent Sidebar Minimap & TOC**:
  - **Duplicate Occurrence Badges**: Headings sharing identical titles automatically display subtle, modern occurrence indicator badges (`#1`, `#2`, `#3`) in the TOC minimap.
  - **Contextual Tooltips**: Hovering over duplicate headings displays rich metadata, including occurrence index, total occurrences, and source line number (e.g. `Overview [Section #2 of 3] (Line 45)`).
  - **Target Jump Flash Animation**: Clicking any heading in the TOC smoothly scrolls to the exact section and triggers an accent glow pulse animation (`@keyframes headingTargetPulse`) for immediate visual feedback.
  - **Pinpoint ScrollSpy**: As you scroll through the document, the active TOC tracker highlights strictly the individual visible occurrence.

## [1.1.4]
### Added
- **Bidirectional Selection Sync**: Enjoy seamless, native-feeling selection synchronization between your editor and preview.
  - Selecting a paragraph or block of text in your Markdown editor instantly highlights the corresponding section in the preview.
  - Selecting or highlighting text inside the preview automatically selects the corresponding lines inside your editor and scrolls them smoothly into view.
- **Visual Selection Highlights**: Rendered highlights on the preview side feature a beautiful theme-matching dashed border and dynamic translucent background matching your active VS Code theme's selection colors.
- **Smart Deselection**: Simply click anywhere inside the empty workspace of either the editor or the preview panel to instantly clear active highlights and collapse selections on both sides.
- **Selection Sync Configuration**: Added the `mdViewer.preview.syncSelection` setting under VS Code configuration settings, allowing you to easily toggle bidirectional selection sync on or off.

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
