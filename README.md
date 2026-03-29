# mark2pdf

English | [简体中文](./README.zh-CN.md)

`mark2pdf` is a simple Node.js CLI for batch document workflows:

- Markdown → PDF
- HTML → PDF
- Merge PDFs
- Extract text from PDF / Word

## Why this tool

Use it when you want one CLI for conversion, merging, and extraction in docs/report pipelines.

## Requirements

- Node.js >= `16.15.0`
- pnpm (recommended) or npm

## Install

```bash
git clone https://github.com/evanfang0054/mark2pdf.git
cd mark2pdf
pnpm install
pnpm run build
```

Optional global command:

```bash
npm link
mark2pdf --help
```

## Quick start

```bash
# Markdown / unified conversion entry
mark2pdf convert -i ./docs

# HTML to PDF
mark2pdf html -i ./public/html

# Merge PDFs
mark2pdf merge -i ./dist/pdf

# Extract text
mark2pdf extract -i ./input -f md
```

## Commands

### convert (default)

```bash
mark2pdf convert [options]
```

Common options:

- `-i, --input <path>` input file or directory (default: `./public/md`)
- `-o, --output <path>` output directory (if omitted: `./output/convert`)
- `-c, --config <path>` config file path
- `--page-size <size>` `A4|Letter|A3|A5`
- `--concurrent <n>` concurrency
- `--timeout <ms>` timeout
- `--out-format <format>` `txt|md|json` for extraction
- `--dry-run` print plan only
- `--show-config` print resolved config and sources
- `--report-json <path>` write structured JSON report
- `--verbose` verbose logs

### html

```bash
mark2pdf html [options]
```

- `-i, --input <path>` default: `./public/html`
- `-o, --output <path>` if omitted: `./output/html`
- `-c, --config <path>` config file path
- `--format <type>` page format, default `A4`
- `--verbose` verbose logs

### merge

```bash
mark2pdf merge [options]
```

- `-i, --input <path>` default: `./dist/pdf`
- `-o, --output <path>` if omitted: `./output/merge`
- `-c, --config <path>` config file path
- `--verbose` verbose logs

### extract

```bash
mark2pdf extract [options]
```

- `-i, --input <path>` default: `./input`
- `-o, --output <path>` if omitted: `./output/extract`
- `-f, --format <format>` `txt|md|json`
- `--verbose` verbose logs

### init

```bash
mark2pdf init [options]
```

- `-g, --global` create global config

## Global flags

- `--json`: structured JSON output (agent mode)
- `--no-color`: disable colors
- `-q, --quiet`: quiet mode (errors only)
- `-v, --verbose`: verbose logs
- `--no-input`: disable interactive prompts
- `--limit <n>`: max files to process (default 50, 0 = unlimited)

## Configuration precedence

Configuration loads in this order (highest first):

1. **CLI flags** (e.g., `--input ./docs`)
2. **Environment variables** (`MARK2PDF_INPUT_PATH`, `MARK2PDF_OUTPUT_PATH`)
3. **Project config** (`./mark2pdf.config.json`, `./config.json`)
4. **User config** (`~/.mark2pdf/config.json`)
5. **Defaults**

See [docs/cli-spec.md](./docs/cli-spec.md) for full CLI specification.

## Output and reports (KISS)

- Default output root: `./output/<command>`
- Latest run report: `./output/<command>/_latest-report.json`
- You can still set a custom output path using `--output`

## Config files

- `config.json` for Markdown conversion
- `html2pdf.config.json` for HTML conversion
- `merge.config.json` for PDF merge

## Dev scripts

```bash
pnpm run build
pnpm test
pnpm run type-check
pnpm run clean
```

## License

ISC
