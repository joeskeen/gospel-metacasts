import { existsSync, readFileSync } from 'fs';
import YAML from 'yaml';

export function loadYaml<T = any>(filePath: string): T {
  return existsSync(filePath)
    ? (YAML.parse(readFileSync(filePath, "utf8")) as T)
    : ({} as unknown as T);
}
