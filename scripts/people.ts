import { join } from "path";
import { readdirSync, readFileSync } from "fs";
import YAML from "yaml";

const __dirname = import.meta.dirname;
const peopleDir = join(__dirname, "../data/people");

export type People = Map<string, Person>;

let people: People | null = null;

export function getPeople(): People {
  if (!people) {
    people = loadPeople();
  }
  return people;
}

export function loadPeople(): People {
  const people = new Map<string, Person>();
  for (const file of readdirSync(peopleDir)) {
    if (file.endsWith(".yml")) {
      const person = YAML.parse(readFileSync(join(peopleDir, file)).toString());
      const id = file.replace(/\.yml$/, '');
      people.set(id, person);
    }
  }
  return people;
}

export interface Person {
  id: string; // Slug, e.g. "jeffrey-r-holland"
  name: string; // Canonical display name, e.g. "Elder Jeffrey R. Holland"
  aliases?: string[]; // Optional alternate names or titles
  titles?: {
    [year: string]: string; // Optional historical titles by year, e.g. { "2025": "President" }
  };
  photo?: string; // Optional path or URL to speaker image
  bio?: string; // Optional short biography
  website?: string; // Optional personal or official page
  tags?: string[]; // Optional grouping tags (e.g. "apostle", "presidency")
}
