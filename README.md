<p align="center">
  <img src="assets/icon.png" width="128" alt="MD Previewer Icon">
</p>

# MD Previewer

[![Version](https://badgen.net/vs-marketplace/v/allwin-antony.md-viewer?style=flat-square)](https://marketplace.visualstudio.com/items?itemName=allwin-antony.md-viewer) [![Installs](https://badgen.net/vs-marketplace/i/allwin-antony.md-viewer?style=flat-square)](https://marketplace.visualstudio.com/items?itemName=allwin-antony.md-viewer) [![Open VSX Version](https://img.shields.io/open-vsx/v/allwin-antony/md-viewer?style=flat-square)](https://open-vsx.org/extension/allwin-antony/md-viewer) [![Open VSX Downloads](https://img.shields.io/open-vsx/dt/allwin-antony/md-viewer?style=flat-square)](https://open-vsx.org/extension/allwin-antony/md-viewer) [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](https://opensource.org/licenses/MIT)

A high-performance, structurally optimized Markdown previewer for Visual Studio Code featuring advanced syntax translation, offline support, interactive integrations, and smooth bidirectional synchronization.

**MD Previewer** provides a seamless, GitLab-style preview environment for Markdown documents. Engineered for speed and precision, it combines an advanced rendering pipeline with native-feeling UI components to deliver a robust documentation workflow.

---

## 🌟 Premium Features

### 🔌 100% Offline Mode (Air-Gapped Environments)
All third-party heavy dependencies are bundled directly inside the extension folder:
* **KaTeX** math libraries and standard glyph fonts.
* **Highlight.js** dark/light syntax coloring stylesheets.
* **Mermaid** dynamic diagrammatic chart scripting.
* **Morphdom** micro-diffing HTML engine.
The extension functions flawlessly without an active internet connection, satisfying the highest privacy and air-gapped development requirements.

### 🔄 Interactive Task Lists (Two-Way Sync)
Clicking a checkbox inside the preview directly toggles the corresponding `- [ ]` <-> `- [x]` Markdown syntax in your active text editor. The modification runs as a native VS Code edit action, fully preserving the editor's undo/redo history stack!

### 🎯 Bidirectional Selection Synchronization
Maintain a fully unified editing experience with absolute synchronicity between your source code and visual output:
* **Editor-to-Preview Selection:** Selecting a paragraph, heading, list item, or code block inside your Markdown source editor instantly highlights the corresponding block on the preview side using a sleek, theme-matching dashed border and subtle translucent selection overlay.
* **Preview-to-Editor Selection:** Selecting text inside the rendered preview automatically highlights and selects the corresponding lines inside your VS Code text editor, scrolling it smoothly into view.
* **Intelligent Deselection:** Clicking in the empty workspace of either the editor or the preview instantly clears active selections and highlights in both windows simultaneously.
* **Complete User Customizability:** Easily toggle selection synchronization on or off via the `mdViewer.preview.syncSelection` configuration setting.

### 🎨 GitLab & GitHub Callout Alert Blocks
Standard blockquotes starting with alert syntax are rendered as premium, visually striking callouts featuring harmonious color palettes, custom SVG icons, and theme-accented borders:
* `> [!NOTE]` — Sleek blue info callout.
* `> [!TIP]` — Vivid green optimization tip.
* `> [!IMPORTANT]` — Regal violet critical guidance.
* `> [!WARNING]` — Energetic amber warning notice.
* `> [!CAUTION]` — High-contrast red high-risk warning.

### 💾 Standalone HTML & PDF Exporters
Export your documents instantly using the download icons in the Outline sidebar:
* **HTML Exporter:** Packages all custom preview styles, KaTeX formulas, Highlight.js code themes, and dynamically converts all local relative images into Base64 data-URIs. All interactive sidebar controls are stripped out using robust HTML comment boundary markers, producing a single, highly portable, self-contained `.html` file.
* **PDF Exporter:** Headless Chrome or Chromium prints publication-ready PDF documents locally. Includes smart path heuristics for Linux (fully compatible with sandboxed Snap & Flatpak environments) and provides direct settings link troubleshooting if no local browser executable is detected.

### 📋 Hover "Copy Code" Utility
Subtle clipboard copy buttons fade in at the top-right of every fenced pre/code block. Clicking a button runs a secure clipboard copy operation and animates the icon into a checkmark with a temporary green micro-animation.

### 🔍 Glassmorphic Image Lightbox
All rendered markdown images (excluding emojis, alert icons, and linked badges) are interactive zoom targets. Clicking on an image displays it in a premium fullscreen glassmorphic overlay with background blur and a dedicated close button (`×`) with smooth micro-animations. The zoom fades out gracefully on clicking the close button, clicking anywhere on the backdrop, or pressing the `Escape` key.

### 🧬 Resilient Mermaid & UML Translators
* **Theme-Aware Rendering:** Mermaid initializes dynamically with custom contrast variables. It automatically re-renders with `theme: 'dark'` or `theme: 'default'` when switching VS Code themes.
* **Typo Resilience:** The parser automatically sanitizes common typing habits by stripping trailing semicolons on diagram type declaration lines (e.g. `graph TD;` -> `graph TD`), preventing parser syntax errors.
* **UML & Sequence Translators:** Automatically parses `wsd`, `websequence`, `sequence`, `uml`, and `plantuml` blocks, translating them into native Mermaid sequence charts for a seamless viewing experience.

### 📑 Intelligent Sidebar Minimap & Duplicate Heading Navigation
The collapsible Table of Contents outline panel provides deep structural visibility:
* **Duplicate Heading Deduplication:** Assigns deterministic, standard GitHub-compatible anchor IDs (`overview`, `overview-1`, `overview-2`), resolving DOM collisions.
* **Occurrence Badges:** Identical heading titles automatically display subtle occurrence tags (`#1`, `#2`, `#3`) in the sidebar minimap.
* **Contextual Tooltips:** Hovering over any TOC entry displays section hierarchy, occurrence count, and exact source line numbers.
* **Glow Pulse on Jump:** Clicking any TOC link smoothly scrolls to the exact heading and flashes a gentle accent glow animation (`heading-target-pulse`) for instant orientation.
* **Pinpoint ScrollSpy:** As you scroll through the document, the TOC sidebar tracks and highlights strictly the currently visible occurrence.

### 🗂️ Smart Split Panel Layout Management
The extension maintains a highly polished, non-cluttering workspace by dynamically tracking active editor columns:
* **Anti-Clutter Capping:** Spawning previews will **never** create a new right column (Column 4, etc.), keeping your workbench perfectly clean.
* **Adjacent Split Routing:**
  * If the markdown editor is open in **Column 1**, the preview opens to its right in **Column 2**.
  * If the markdown editor is in **Column 2 or higher** (e.g., Column 3), the preview automatically opens to its left in **Column - 1** (e.g., Column 2 for a Column 3 editor, Column 1 for a Column 2 editor).
This ensures your preview is always kept **directly adjacent** to the active editor for seamless side-by-side editing.


---

## 🚀 Scroll Synchronization & Architecture

MD Previewer is built on a highly optimized, near-zero footprint architecture to prevent extension lag:

1. **Host-Side Scroll Loop Guard:** By keeping a shared programmatic scrolling registry (`hostScrollingPanels`), the editor ignores incoming scroll updates generated programmatically by sync events, completely eliminating jittery scroll fighting and infinite loop echo loops.
2. **Client-Side User Interaction Lock:** The webview tracks active scrolling gestures (`mouseenter`, `focus`, `wheel`, `touchstart`, `keydown`). It only sends coordinate updates back to the active editor if the user is actively interacting with the preview window.
3. **Fine-Grained Block Spy Matching:** Line attribute markers (`data-line`) are dynamically mapped to *every* block-level element featuring source mapping (including individual nested table rows `tr` and list items `li`), allowing smooth, precise, row-by-row scroll tracking through extremely large tables.
4. **Morphdom Surgical DOM Patches:** Batch updates are debounced (150ms limits) and processed through client-side morphdiffing. This avoids destructive `innerHTML` resets, preserving the state of elements (such as playing YouTube interactive players) while you type!

---

## ⚙️ Configuration

Customize the preview typography and PDF renderer behavior in your VS Code `settings.json`:

| Setting | Type | Default Value | Description |
|---------|------|---------------|-------------|
| `mdViewer.chromePath` | `string` | `""` | Absolute path to local Google Chrome or Chromium executable. If empty, the system will auto-detect it. |
| `mdViewer.preview.fontFamily` | `string` | System Font Stack | Custom CSS font family for preview typography. |
| `mdViewer.preview.fontSize` | `string` | `"14px"` | Custom CSS font size for preview typography. |
| `mdViewer.preview.lineHeight` | `string` | `"1.7"` | Custom line height for preview typography. |
| `mdViewer.preview.syncSelection` | `boolean` | `true` | Enable bidirectional selection synchronization between the markdown editor and the preview. |

---

## 🛠️ Usage

You can launch MD Previewer using either of the following methods:

### 1. Editor Title Bar
Open any `.md` file and click the **View Preview** icon located in the top-right corner of the active editor.

![Initiating via Button Click](assets/button_click.gif)

### 2. Context Menu
Right-click any `.md` file in the VS Code File Explorer and select **View Preview**.

![Initiating via Context Menu](assets/context_menu.gif)

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

**Developed by Allwin S Antony**
