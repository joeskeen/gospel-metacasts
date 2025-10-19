import fs from 'fs';
import path, {basename, join} from 'path';
import YAML from 'yaml';

const __dirname = import.meta.dirname;

const EPISODE_DIR = join(__dirname, '../data/episodes');
const SPEAKER_DIR = join(__dirname, '../data/people');

const errors: string[] = [];

function validateEpisodeFile(filePath: string, knownSpeakers: Set<string>) {
  const content = fs.readFileSync(filePath, 'utf8');
  const data = YAML.parse(content) as any;

  const relPath = path.relative(EPISODE_DIR, filePath);

  // Required fields
  const required = ['id', 'title', 'speaker', 'date', 'topics'];
  for (const field of required) {
    if (!data[field]) errors.push(`${relPath}: missing required field '${field}'`);
  }
  if (!data.links.mp3) {
    errors.push(`${relPath}: missing required field 'links.mp3'`);
  }

  // Format checks
  if (data.id && !/^[a-z0-9\-éñí]+$/.test(data.id)) {
    errors.push(`${relPath}: invalid id format`);
  }
  if (data.id !== basename(filePath, '.yml')) {
    errors.push(`${relPath}: id does not match filename`);
  }

  if (data.date && !/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
    errors.push(`${relPath}: invalid date format`);
  }

  if (data.duration && !/^(\d{2}:)?\d{2}:\d{2}$/.test(data.duration)) {
    errors.push(`${relPath}: invalid duration format`);
  }

  if (data.season && typeof data.season !== 'number') {
    errors.push(`${relPath}: season must be a number`);
  }

  // Cross-references
  if (data.speaker && !knownSpeakers.has(data.speaker.id)) {
    errors.push(`${relPath}: unknown speaker '${data.speaker.id}'`);
  }
}

function loadSpeakers(dir: string): Set<string> {
  return new Set(fs.readdirSync(dir).map(f => path.basename(f, '.yml')));
}

function main() {
  const knownSpeakers = loadSpeakers(SPEAKER_DIR);

  const episodeFiles: string[] = [];

  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (fs.statSync(full).isDirectory()) walk(full);
      else if (entry.endsWith('.yml') && !/^_/.test(basename(entry))) episodeFiles.push(full);
    }
  }

  walk(EPISODE_DIR);

  for (const file of episodeFiles) {
    validateEpisodeFile(file, knownSpeakers);
  }

  if (errors.length) {
    console.error(`❌ Found ${errors.length} issues:`);
    for (const err of errors) console.error('  -', err);
    process.exit(1);
  } else {
    console.log('✅ All metadata files are valid.');
  }
}

main();
