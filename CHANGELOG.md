# Changelog

## [1.2.1]
### Added
- **Dynamic JS & Mermaid Wait Hook**:
  - **Headless Render Synchronization**: Injected `--run-all-compositor-stages-before-draw` and `--virtual-time-budget=2000` into headless Chrome/Chromium to give asynchronous JavaScript (KaTeX formulas, Mermaid vector diagrams) full time to compute layout and render before the PDF snapshot is captured.
  - **Asynchronous Callback Hooks**: Added `mermaid.run()` completion callbacks and `DOMContentLoaded` listeners setting `document.body.dataset.rendered = "true"`.
- **PDF Print Customization Options**:
  - **Paper Page Size (`mdViewer.pdf.pageSize`)**: Support for `A4` (default), `Letter`, `Legal`, `Tabloid`, `A3`, and `A5`.
  - **Page Orientation (`mdViewer.pdf.orientation`)**: Choose between `portrait` (default) and `landscape`.
  - **Custom Page Margins (`mdViewer.pdf.margins`)**: Configurable presets for `normal` (15mm), `compact` (8mm), `academic` (1 inch / 25.4mm), and `none` (0mm).
  - **Header & Footer Toggle (`mdViewer.pdf.headerFooter`)**: Option to include or suppress default browser page numbers and generation dates.
- **Public Extension API**:
  - Exported `exportPdf` and `exportHtml` directly from `activate()`, allowing other VS Code extensions and AI tools to interface via `vscode.extensions.getExtension('allwin-antony.md-viewer')?.exports`.

## [1.2.0]
### Added
- **Programmatic & AI Agent Export Automation**:
  - **`mdViewer.exportPdf` Command**: Dedicated VS Code command callable by AI agents (e.g., Google Antigravity), background tasks, or scripts via `vscode.commands.executeCommand('mdViewer.exportPdf', mdUri, targetPdfPath)`.
  - **`mdViewer.exportHtml` Command**: Dedicated VS Code command for standalone HTML export via `vscode.commands.executeCommand('mdViewer.exportHtml', mdUri, targetHtmlPath)`.
  - **Headless Background Export**: Supplying an output path skips interactive GUI save dialogs and generates the PDF/HTML headlessly in the background.
  - **Command Palette & Context Menu**: Easily trigger exports from the VS Code Command Palette or by right-clicking any `.md` file in the File Explorer.

## [1.1.6]
### Added
- **Cross-Platform Image Export (PDF & Standalone HTML)**:
  - **Base64 Data URI Inlining**: Converted all local image paths to self-contained Base64 Data URIs (`data:image/...;base64,...`) during PDF export and standalone HTML export, ensuring 100% synchronous rendering in headless Chrome/Chromium without missing or dropped images.
  - **Universal Path Support**: Added comprehensive path resolution supporting relative paths (`./images/img.png`, `..\assets\img.png`), Windows absolute paths (`C:\...`, `C:/...`), Linux absolute paths (`/...`), `file:///` URIs, and paths with spaces/URL encodings (`%20`).
  - **Broad Format Support**: Full support for `.png`, `.jpg`/`.jpeg`, `.gif`, `.svg`, `.webp`, `.bmp`, `.ico`, `.tiff`, and `.avif`.
  - **Webview Drive Roots & Linux Root Access**: Configured `localResourceRoots` to grant webview permission to load local images across all Windows drive letters (`C:\`, `D:\`, etc.) and Linux root (`/`).
  - **Print CSS Image Optimization**: Added `page-break-inside: avoid`, `max-width: 100%`, and `height: auto` constraints to ensure images display clearly without page-boundary clipping or layout distortion.

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
