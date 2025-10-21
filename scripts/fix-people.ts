import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join, basename } from 'path';
import YAML from 'yaml';
const __dirname = import.meta.dirname;
const ROOT = join(__dirname, '..');
const PEOPLE_DIR = join(ROOT, 'data/people');
const CONFERENCE_DIR = join(ROOT, 'data/episodes/general-conference');

const validTitles = [
  'Sister',
  'Elder',
  'President',
  'Bishop',
  'Brother'
];

const episodeFiles = (readdirSync(CONFERENCE_DIR, { recursive: true }) as string[])
  .filter(f => basename(f).endsWith('.yml') && !basename(f).startsWith('_'))
  .map(f => join(CONFERENCE_DIR, f))
  .map(f => ({path: f, contents: YAML.parse(readFileSync(f).toString())}));

const personFiles = readdirSync(PEOPLE_DIR).map(f => join(PEOPLE_DIR,f))
  .map(f => ({path: f, contents: YAML.parse(readFileSync(f).toString())}));

for (let talkFile of episodeFiles) {
  const title = talkFile.contents.speaker?.title?.short;
  if (!title || validTitles.includes(title)) {
    continue;
  }

  const existingPersonId = talkFile.contents.speaker.id;
  const correctPersonId = `${title} ${existingPersonId.replace(/-+/g,' ')}`.toLowerCase().trim().replace(/ /g, '-');
  console.log('invalid title:', title);
  console.log('-> person id:', existingPersonId);
  console.log('-> should be:', correctPersonId);
  let person = personFiles.find(p => p.contents.id === existingPersonId);
  if (!person) {
    person = personFiles.find(p => p.contents.id === correctPersonId);
  }

  if (!person) {
    console.error(`[ERROR]: can't find person: (${title}) ${existingPersonId} -> ${correctPersonId}`);
    continue;
  }

  person.contents.id = correctPersonId;
  person.contents.name = `${title} ${person.contents.name}`;
  writeFileSync(person.path, YAML.stringify(person.contents));
  
  delete talkFile.contents.speaker.title.short;
  talkFile.contents.speaker.id = correctPersonId;
  talkFile.contents.id = talkFile.contents.id.replace(existingPersonId, correctPersonId);
  writeFileSync(talkFile.path, YAML.stringify(talkFile.contents));

  console.log('fixed!\n');
}

// const allTitles = files.reduce((acc, curr) => {
//   acc.add(curr.contents.speaker?.title?.short);
//   return acc;
// }, new Set<string>());


// console.log([...allTitles.values()].filter(t => !validTitles.includes(t)).sort((a,b) => a?.localeCompare(b ?? '')));


// console.log('People with suspiciously incorrect names:');
// for(let f of files) {
//   const personId = basename(f).replace(/\.yml$/g, '');
//   const nameParts = personId.split('-');
//   if (nameParts.length === 3) {
//     continue;
//   }

//   if (nameParts.length === 2 && nameParts.every(p => p.length > 1)) {
//     continue;
//   }

//   console.error(nameParts);
// }
