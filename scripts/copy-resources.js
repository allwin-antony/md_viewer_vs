const fs = require('fs');
const path = require('path');

const workspaceDir = path.resolve(__dirname, '..');
const nodeModulesDir = path.join(workspaceDir, 'node_modules');
const resourcesDir = path.join(workspaceDir, 'resources');

// Helper to copy file
function copyFile(src, dest) {
  const destDir = path.dirname(dest);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  fs.copyFileSync(src, dest);
  console.log(`Copied ${path.relative(workspaceDir, src)} -> ${path.relative(workspaceDir, dest)}`);
}

// Helper to copy directory recursively
function copyDir(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
      console.log(`Copied ${path.relative(workspaceDir, srcPath)} -> ${path.relative(workspaceDir, destPath)}`);
    }
  }
}

// Copy assets
try {
  // 1. KaTeX CSS and JS
  copyFile(
    path.join(nodeModulesDir, 'katex', 'dist', 'katex.min.js'),
    path.join(resourcesDir, 'katex', 'katex.min.js')
  );
  copyFile(
    path.join(nodeModulesDir, 'katex', 'dist', 'katex.min.css'),
    path.join(resourcesDir, 'katex', 'katex.min.css')
  );
  // Copy KaTeX fonts directory
  copyDir(
    path.join(nodeModulesDir, 'katex', 'dist', 'fonts'),
    path.join(resourcesDir, 'katex', 'fonts')
  );

  // 2. Highlight.js CSS Themes
  copyFile(
    path.join(nodeModulesDir, 'highlight.js', 'styles', 'github.css'),
    path.join(resourcesDir, 'highlight', 'github.min.css')
  );
  copyFile(
    path.join(nodeModulesDir, 'highlight.js', 'styles', 'github-dark.css'),
    path.join(resourcesDir, 'highlight', 'github-dark.min.css')
  );

  // 3. Morphdom JS
  // Check common package layouts for morphdom
  const morphdomSrc = path.join(nodeModulesDir, 'morphdom', 'dist', 'morphdom-umd.min.js');
  if (fs.existsSync(morphdomSrc)) {
    copyFile(morphdomSrc, path.join(resourcesDir, 'morphdom', 'morphdom-umd.min.js'));
  } else {
    // Try browser-oriented minified bundles
    const morphdomAlt = path.join(nodeModulesDir, 'morphdom', 'dist', 'morphdom-umd.js');
    if (fs.existsSync(morphdomAlt)) {
      copyFile(morphdomAlt, path.join(resourcesDir, 'morphdom', 'morphdom-umd.min.js'));
    } else {
      console.error("Could not find morphdom minified output!");
    }
  }

  // 4. Mermaid JS
  // Check mermaid dist minified
  const mermaidSrc = path.join(nodeModulesDir, 'mermaid', 'dist', 'mermaid.min.js');
  if (fs.existsSync(mermaidSrc)) {
    copyFile(mermaidSrc, path.join(resourcesDir, 'mermaid', 'mermaid.min.js'));
  } else {
    console.error("Could not find mermaid minified output at " + mermaidSrc);
  }

  console.log("All assets copied successfully to resources folder!");
} catch (e) {
  console.error("Error copying assets:", e);
  process.exit(1);
}
