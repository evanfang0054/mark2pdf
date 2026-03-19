# mark2pdf

English | [简体中文](./README.zh-CN.md)

`mark2pdf` is a Node.js CLI for batch document processing:

- Markdown → PDF
- HTML → PDF
- Merge multiple PDFs
- Extract text from PDF / Word

It is useful for documentation publishing, report generation, and content archiving workflows.

## Features

- Batch processing for files and directories
- Optional directory-structure preservation in output
- Concurrency and timeout controls
- `dry-run` mode to preview execution plan
- Structured JSON execution reports
- Built-in Chinese font detection and fallback
- Path validation and verbose error logging

## Requirements

- Node.js >= `16.15.0`
- pnpm (recommended) or npm

## Installation

### 1) Local development

```bash
git clone https://github.com/evanfang0054/mark2pdf.git
cd mark2pdf
pnpm install
pnpm run build
```

### 2) Use as a global command

```bash
# Build first in project directory
npm link

# Verify
mark2pdf --version
mark2pdf --help
```

### 3) Run directly via npx

```bash
npx mark2pdf@latest --help
```

## Quick Start

### Convert Markdown (default command)

```bash
mark2pdf convert -i ./docs -o ./dist/pdf
```

### Convert HTML

```bash
mark2pdf html -i ./public/html -o ./dist/pdf
```

### Merge PDFs

```bash
mark2pdf merge -i ./dist/pdf -o ./dist/merged
```

### Extract text

```bash
mark2pdf extract -i ./input -o ./output -f md
```

## CLI Commands

### `convert` (default)

Unified entry point that dispatches conversion/extraction based on input type.

```bash
mark2pdf convert [options]
```

Common options:

- `-i, --input <path>` Input file or directory (default: `./public/md`)
- `-o, --output <path>` Output directory (default: `./dist/pdf`)
- `-c, --config <path>` Config file path
- `--page-size <size>` Page size (`A4|Letter|A3|A5`)
- `--concurrent <n>` Concurrency
- `--timeout <ms>` Timeout in milliseconds
- `--out-format <format>` Extraction format (`txt|md|json`)
- `--dry-run` Print execution plan only
- `--show-config` Print resolved config and source
- `--report-json <path>` Write structured execution report
- `--verbose` Verbose logs

### `html`

```bash
mark2pdf html [options]
```

Common options:

- `-i, --input <path>` Input directory (default: `./public/html`)
- `-o, --output <path>` Output directory (default: `./dist/pdf`)
- `-c, --config <path>` Config file path
- `--format <type>` Page format (default: `A4`)
- `--verbose` Verbose logs

### `merge`

```bash
mark2pdf merge [options]
```

Common options:

- `-i, --input <path>` Input directory (default: `./dist/pdf`)
- `-o, --output <path>` Output directory (default: `./dist/mergePdf`)
- `-c, --config <path>` Config file path
- `--verbose` Verbose logs

### `extract`

```bash
mark2pdf extract [options]
```

Common options:

- `-i, --input <path>` Input file or directory (default: `./input`)
- `-o, --output <path>` Output directory (default: `./output`)
- `-f, --format <format>` Output format (`txt|md|json`)
- `--verbose` Verbose logs

### `init`

```bash
mark2pdf init [options]
```

Common options:

- `-g, --global` Create global config

## Configuration

Default config files by feature:

- `config.json`: Markdown → PDF
- `html2pdf.config.json`: HTML → PDF
- `merge.config.json`: PDF merge

Example (`config.json`):

```json
{
  "input": {
    "path": "./public/md",
    "extensions": [".md"]
  },
  "output": {
    "path": "./public_dist/pdf",
    "createDirIfNotExist": true,
    "maintainDirStructure": true
  },
  "options": {
    "concurrent": 3,
    "timeout": 30000,
    "format": "A4",
    "orientation": "portrait"
  }
}
```

## Development

### Scripts

```bash
pnpm run build         # Build
pnpm run build:watch   # Build in watch mode
pnpm test              # Run tests
pnpm run test:coverage # Coverage report
pnpm run type-check    # Type check
pnpm run clean         # Clean dist/coverage
```

### Project Structure (simplified)

```text
src/
  bin/        # CLI entry
  cli/        # Command handlers
  core/       # Core conversion/merge logic
  services/   # Service layer
  config/     # Config loading and validation
  utils/      # Utilities
tests/        # Tests
assets/       # Static assets (styles/fonts)
```

## FAQ

### No output files are generated

Run:

```bash
mark2pdf convert --show-config --verbose
```

Then verify input/output paths and extension filters.

### Chinese text is not rendered correctly

The project auto-detects system fonts and uses fallback fonts. If rendering is still incorrect, install an available Chinese font on your system or provide one under `assets`.

### Batch processing is slow

Adjust concurrency, for example:

```bash
mark2pdf convert --concurrent 4
```

Too high concurrency may increase memory pressure.

## Compatibility Notes

- `--format` in `convert` is kept for backward compatibility.
- Prefer `--page-size` for new usage.

## License

ISC
