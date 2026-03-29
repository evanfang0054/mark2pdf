#!/usr/bin/env bash
# mark2pdf bash completion

_mark2pdf_completion() {
  local cur prev command
  COMPREPLY=()
  cur="${COMP_WORDS[COMP_CWORD]}"
  prev="${COMP_WORDS[COMP_CWORD-1]}"
  command="${COMP_WORDS[1]}"

  local global_options="--json --no-color -q --quiet --no-input -v --verbose --limit --help --version"
  local commands="convert html merge extract init completion"

  if [[ ${COMP_CWORD} -eq 1 ]]; then
    COMPREPLY=( $(compgen -W "${commands} ${global_options}" -- "${cur}") )
    return 0
  fi

  if [[ ${prev} == completion ]]; then
    COMPREPLY=( $(compgen -W "bash zsh" -- "${cur}") )
    return 0
  fi

  case "${command}" in
    convert)
      COMPREPLY=( $(compgen -W "-i --input -o --output -c --config -t --theme --concurrent --timeout --page-size --out-format --dry-run --show-config --report-json --verbose ${global_options}" -- "${cur}") )
      ;;
    html)
      COMPREPLY=( $(compgen -W "-i --input -o --output -c --config --format --verbose ${global_options}" -- "${cur}") )
      ;;
    merge)
      COMPREPLY=( $(compgen -W "-i --input -o --output -c --config --verbose ${global_options}" -- "${cur}") )
      ;;
    extract)
      COMPREPLY=( $(compgen -W "-i --input -o --output --out-format -f --format --verbose ${global_options}" -- "${cur}") )
      ;;
    init)
      COMPREPLY=( $(compgen -W "-g --global ${global_options}" -- "${cur}") )
      ;;
    *)
      COMPREPLY=( $(compgen -W "${commands} ${global_options}" -- "${cur}") )
      ;;
  esac
}

complete -F _mark2pdf_completion mark2pdf
