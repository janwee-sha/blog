#!/usr/bin/env bash

set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
staging_dir="$repo_dir/.migration"
output_file="$staging_dir/wordpress-export.json"
temporary_file="$output_file.tmp"

mkdir -p "$staging_dir"
docker exec -i wordpress php < "$repo_dir/scripts/export-wordpress.php" > "$temporary_file"
node -e 'JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"))' "$temporary_file"
mv "$temporary_file" "$output_file"

printf 'Exported the public WordPress migration snapshot to %s\n' "$output_file"
