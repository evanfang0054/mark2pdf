# Changelog

All notable changes to this project will be documented in this file.

## [3.0.0] - 2026-03-29

### Breaking Changes
- `--format` flag in `convert` command renamed to `--page-size`
- `--format` flag in `extract` command renamed to `--out-format`
- Default list output limited to 50 items (use `--limit 0` to remove limit)

### Added
- Global `--json` flag for structured output (Agent mode)
- Global `--quiet` flag for quiet mode
- Global `--no-color` flag and `NO_COLOR` environment variable support
- Global `--no-input` flag to disable interactive prompts
- Global `--limit` flag to control list boundaries
- `mark2pdf completion` command to generate shell completion scripts
- Structured error output (JSON mode)
- Usage examples in help text
- `docs/cli-spec.md` documenting configuration precedence and CLI specification

### Changed
- Improved error message actionability and recovery hints
- Configuration precedence now explicitly documented
- CLI output modes: human (default), agent (--json), quiet (--quiet)

### Fixed
- Unified output directory strategy with command-scoped defaults
- Failure stage summary now consistently reported

## [2.2.0] - 2026-03-19

### Added
- Unified output directory strategy
- Failure stage summary

### Changed
- Documentation improvements

## [2.1.0] - 2026-03-18

### Added
- Enhanced error handling

## [2.0.0] - 2026-03-17

### Added
- Initial stable release
