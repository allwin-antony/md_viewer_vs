# MD Viewer

A high-performance, GitLab-style Markdown Viewer for Visual Studio Code.

MD Viewer provides a seamless way to preview your Markdown documents right beside your code. It's packed with modern features, fully optimized for performance, and designed to match the look and feel of major platforms like GitLab.

## Features

- **Toggle View Interface:** A convenient `</>` toggle button sits right in your editor title bar. Click it to seamlessly switch between raw Markdown and the rendered HTML preview.
- **Live Preview:** Edits you make to the markdown document update the preview in real-time.
- **Mathematical Formulas (KaTeX):** Supports inline math (`$x^2$`) and block equations (`$$x^2$$`) rendered identically to GitLab/Academic standards, complete with proper display alignment.
- **Mermaid Diagrams:** Client-side rendering of flowchart, sequence, and gantt diagrams.
- **Code Syntax Highlighting:** Powered by Highlight.js to give your code blocks the VS Code theme treatment.
- **Smart Relative Linking:** Clicking a relative link (like `[Guide](guide.md)`) from within the preview automatically opens that file inside your VS Code workspace.
- **Anchor Navigation:** Smooth-scrolling table-of-contents support. Heading links (`#my-heading`) smoothly scroll to the exact spot in the preview.
- **Task Lists & Emojis:** Native rendering for `- [x]` checkboxes and `:smile:` shortcodes.
- **Local Images:** Fully supports relative image paths (`./images/screenshot.png`), complete with URL-decoding capabilities for files with spaces.

## Performance Optimized

MD Viewer is designed from the ground up for minimal Extension Host overhead:
- **Client-Side Heavy Lifting:** Mermaid diagrams and KaTeX mathematics are strictly processed client-side inside the Webview DOM, avoiding blocking operations in Node.js.
- **Render Caching:** Markdown HTML structures and file-system image validations are heavily cached. The extension only re-calculates elements when the file is genuinely modified.
- **Incremental Increments:** Webviews aren't lazily recreated on changes. We utilize high-speed `postMessage` architecture to seamlessly swap the `innerHTML` live.
- **Micro-Bundle:** Compiled under Webpack Production configurations, ensuring small footprints and fast load times.

## How to Use

1. Open any `.md` file in Visual Studio Code.
2. Look at the top-right corner of your editor tab (the Editor Title menu).
3. Click the `</>` (Toggle MD/HTML View) button.
4. The preview will open. You can split it to the side to see live updates as you type!

## Development

To build and compile the extension locally:

```bash
npm install
npm run compile
```

Press `F5` in VS Code to launch the Extension Development Host and test your changes live.
