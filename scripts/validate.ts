import fs from 'fs';
import path, {join} from 'path';
import yaml from 'yaml';

const __dirname = import.meta.dirname;

const EPISODE_DIR = join(__dirname, '../data/episodes');
const SPEAKER_DIR = join(__dirname, '../data/people');
const SOURCE_DIR = join(__dirname, '../data/sources');

const errors: string[] = [];

function validateEpisodeFile(filePath: string, knownSpeakers: Set<string>, knownSources: Set<string>) {
  const content = fs.readFileSync(filePath, 'utf8');
  const data = yaml.parse(content) as any;

  const relPath = path.relative(EPISODE_DIR, filePath);
  const filename = path.basename(filePath);

  // Required fields
  const required = ['id', 'title', 'speaker', 'source', 'date', 'mp3Url', 'topics'];
  for (const field of required) {
    if (!data[field]) errors.push(`${relPath}: missing required field '${field}'`);
  }

  // Format checks
  if (data.id && !/^[a-z0-9\-]+$/.test(data.id)) {
    errors.push(`${relPath}: invalid id format`);
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
  if (data.speaker && !knownSpeakers.has(data.speaker)) {
    errors.push(`${relPath}: unknown speaker '${data.speaker}'`);
  }

  if (data.source && !knownSources.has(data.source)) {
    errors.push(`${relPath}: unknown source '${data.source}'`);
  }
}

function loadYamlSet(dir: string): Set<string> {
  return new Set(fs.readdirSync(dir).map(f => path.basename(f, '.yaml')));
}

function main() {
  const knownSpeakers = loadYamlSet(SPEAKER_DIR);
  const knownSources = loadYamlSet(SOURCE_DIR);

  const episodeFiles: string[] = [];

  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (fs.statSync(full).isDirectory()) walk(full);
      else if (entry.endsWith('.yaml')) episodeFiles.push(full);
    }
  }

  walk(EPISODE_DIR);

  for (const file of episodeFiles) {
    validateEpisodeFile(file, knownSpeakers, knownSources);
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
