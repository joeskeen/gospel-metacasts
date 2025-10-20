import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join, basename } from 'path';
import { Readable } from 'stream';
import YAML from 'yaml';
import { parseStream } from 'music-metadata';

const __dirname = import.meta.dirname;
const EPISODES_DIR = join(__dirname, '../..', 'data/episodes');

export async function getMp3DurationFromUrl(url: string) {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch MP3: ${response.statusText}`);
    }

    const nodeStream = Readable.fromWeb(response.body);
    const metadata = await parseStream(nodeStream, null, { duration: true });

    const durationInSeconds = metadata.format.duration;
    return Math.floor(durationInSeconds);
  } catch (error) {
    console.error('Error:', error.message, error);
    return null;
  }
}

const files = readdirSync(EPISODES_DIR, {recursive: true});
const ymlFiles = files
  .filter(f => f.endsWith('.yml') && !basename(f).startsWith('_'))
  .map(f => join(EPISODES_DIR, f));

for (let path of ymlFiles) {
  const metadata = YAML.parse(readFileSync(path).toString());
  if (metadata.duration === undefined) {
    const duration = await getMp3DurationFromUrl(metadata.links.mp3);
    metadata.duration = duration;
    writeFileSync(path, YAML.stringify(metadata));
    console.log(`[SUCCESS] ${path}`);
  } else {
    console.log(`-skipped- ${path}`); 
  }
}
