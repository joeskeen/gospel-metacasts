#!/bin/bash

# Find all YAML files
find . -type f \( -iname "*.yml" -o -iname "*.yaml" \) | while read -r filepath; do
  # Extract the ID from the file (assumes format: id: VALUE on its own line)
  id=$(grep -E '^id: ' "$filepath" | sed 's/^id: //')

  # Skip if ID is empty
  if [[ -z "$id" ]]; then
    echo "No ID found in $filepath — skipping"
    continue
  fi

  # Determine new filename
  dir=$(dirname "$filepath")
  ext="${filepath##*.}"
  newpath="$dir/$id.$ext"

  # Rename if needed
  if [[ "$filepath" != "$newpath" ]]; then
    mv "$filepath" "$newpath"
    echo "Renamed: $filepath → $newpath"
  else
    echo "Already correctly named: $filepath"
  fi
done
