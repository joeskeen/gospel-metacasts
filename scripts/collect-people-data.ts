import { writeFileSync } from 'fs';
import { join } from 'path';
import {setTimeout} from 'timers/promises';
import puppeteer from 'puppeteer';
import YAML from 'yaml';
import { getPeople } from './people.ts';

const __dirname = import.meta.dirname;
const ROOT = join(__dirname, '..');
const peopleDir = join(ROOT, 'data/people');

const browser = await puppeteer.launch();
const page = await browser.newPage();

const searchUrl = (id: string) => `https://history.churchofjesuschrist.org/chd/search?query=${id.replaceAll('-', '+')}&tabFacet=people`;
const people = getPeople();

for (let person of people.values()) {
  if (person.photo && person.website) {
    continue;
  }

  try {
    await page.goto(searchUrl(person.id));
    await page.locator('aside.searchBody a').click();
    await page.waitForNavigation();
    const url = page.url();
    const imageUrl = await page.$$eval('figure.profileImage img[src]', i => i[0].src);
  
    const updatedPerson = {
      ...person,
      website: url,
      photo: imageUrl
    };
  
    const personPath = join(peopleDir, `${person.id}.yml`);
    writeFileSync(personPath, YAML.stringify(updatedPerson));
  
    console.log(`updated ${person.name}`, { id: person.id, website: url, photo: imageUrl });
  } catch(err) {
    console.error(person.id, err);
  }
  await setTimeout(1000);
}

process.exit(0);
