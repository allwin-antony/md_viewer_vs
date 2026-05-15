# MD Viewer

A fast, polished Markdown preview extension for Visual Studio Code.

MD Viewer renders Markdown files directly in a side-by-side Webview, with support for advanced content such as math formulas, Mermaid diagrams, syntax highlighting, and smooth anchor navigation.

## Features

- **Markdown preview toggle**: Open or close the rendered view from the editor title bar.
- **Multi-file previews**: Keep multiple Markdown previews open at once, each matched to its source file.
- **KaTeX math support**: Render inline math (`$a^2$`) and display math (`$$x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}$$`).
- **Mermaid diagrams**: Render flowcharts, sequence diagrams, and other Mermaid graph types within the preview.
- **Syntax highlighting**: Code blocks are styled using Highlight.js for better readability.
- **Anchor scrolling**: Click internal heading links and jump smoothly to the correct section.
- **Relative link navigation**: Clicking a local file link opens that file in VS Code.
- **Local image support**: Handles relative image paths and URL-encoded filenames.
- **Task lists and emojis**: Supports GitHub-style task lists and emoji syntax.

## Installation

1. Clone this repository:

```bash
git clone https://github.com/allwin-antony/md_viewer_vs.git
cd md_viewer_vs
```

2. Install dependencies:

```bash
npm install
```

3. Build the extension:

```bash
npm run compile
```

## Running locally

Open the folder in VS Code, then press `F5` to launch the Extension Development Host. Open a Markdown file and use the `Toggle MD/HTML View` command from the editor title bar.

## Usage

1. Open a Markdown file (`.md`).
2. Click the preview toggle icon in the editor title bar.
3. The rendered preview opens next to the source file.
4. Click links, anchors, or local file references directly inside the preview.

## Recommended workflow

- Use side-by-side editing for fast Markdown authoring.
- Keep the preview open while modifying the source file.
- Use heading links and Mermaid blocks to document complex content clearly.

## Development notes

- The extension uses `webpack` to bundle `src/extension.ts` into `dist/extension.js`.
- KaTeX rendering is powered by `markdown-it-katex`.
- Mermaid diagrams are rendered in the preview with client-side Mermaid JS.

## Contributing

If you want to improve the extension, feel free to open issues or submit a pull request.

