import {join} from 'path';
import {readFileSync, writeFileSync, existsSync, mkdirSync} from 'fs';
import YAML from 'yaml';
import { parseStringPromise } from 'xml2js';

const __dirname = import.meta.dirname;
const ROOT = join(__dirname, '../..');
const dataDir = join(ROOT, 'data');
const peopleDir = join(dataDir, 'people');
const confDir = join(dataDir, 'episodes/general-conference');

const baseUrl = 'https://www.churchofjesuschrist.org/study/api/v3/language-pages/type/content?lang=eng&uri=';
const year = 2025;
const month = 4;
let day = 1;
const conferenceUri = `/general-conference/${year}/${month.toString().padStart(2, '0')}`;
const fullUrl = `${baseUrl}${conferenceUri}`;

async function fetchJson(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.json();
}

async function fetchAudioUrl() {
  try {
    // Step 1: Fetch the conference page JSON
    const pageData = await fetchJson(fullUrl);
    const rawHtml = pageData?.content?.body;
    if (!rawHtml) throw new Error('Missing HTML content');

    // Step 2: Wrap and parse the HTML as XML
    const wrappedXml = `<x>${rawHtml}</x>`;
    const parsed = await parseStringPromise(wrappedXml);

    // Step 3: Extract talk links
    const rawLinks: string[] = [];
    const navItems = parsed?.x?.nav?.[0]?.ul?.[0]?.li || [];
    for (const li of navItems) {
      const subItems = li?.ul?.[0]?.li || [];
      for (const subLi of subItems) {
        const href = subLi?.a?.[0]?.$.href;
        if (href) rawLinks.push(href);
      }
    }

    // Step 4: Clean the links
    const talkLinks = rawLinks.map(link => link.split('?')[0].replace('/study', ''));

    let sessionIndex = 0;
    let sequence = 1;

    for(const link of talkLinks) {
      // Step 5: Fetch metadata for the talk
      const talkUrl = `${baseUrl}${link}`;
      const talkData = await fetchJson(talkUrl);
    
      const talkContent = await parseStringPromise(`<x>${talkData.content.body}</x>`);
      const talkTitle = talkContent.x.header?.[0]?.h1?.[0]?._;
      const normalizedTalkTitle = talkTitle.toLowerCase().replace(/\W+/g, '-');
      const authorArray = talkContent.x.header?.[0]?.div?.[0]?.p;
      const author = {
        name: authorArray?.[0]?._.trim().replace(/^By /i, ''),
        title: {
          full: authorArray?.[1]?._
        }
      };
      
      // TODO: collect longform episodes of full sessions
      if (!author.name) {
        sessionIndex++;
        sequence = 1;
        continue;
      }
      
      const shortTitle = author.name?.split(' ')[0];
      author.title.short = shortTitle;
      author.name = author.name?.split(' ').slice(1).join(' ');
      author.id = author.name?.toLowerCase().replace(/\W+/g, '-');
      if (author.id) {
        saveAuthor(author);    
      }
    
      const summary = talkContent.x.header?.[0]?.p?.[0]?._;
      const audioUrl = talkData?.meta?.audio?.[0]?.mediaUrl;
      
      const talk = {
        id: `gc-${year}-${month}-${sessionIndex.toString().padStart(2,'0')}-${sequence.toString().padStart(2,'0')}-${author.id}-${normalizedTalkTitle}`,
        title: talkTitle,
        date: `${year}-${month.toString().padStart(2,'0')}-${day.toString().padStart(2,'0')}`,
        session: sessionIndex,
        sequence,
        links: {
          mp3: audioUrl
        },
        speaker: {
          id: author.id,
          title: author.title
        },
        summary,
        topics: []
      };
      await saveTalk(talk);
      sequence++;
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } catch (error) {
    console.error('Error fetching audio URL:', error);
    return null;
  }
}

fetchAudioUrl();


function saveAuthor(author) {
  const authorPath = join(peopleDir, `${author.id}.yml`);
  const existingAuthor = existsSync(authorPath)
    ? YAML.parse(readFileSync(authorPath).toString())
    : {};
  
  writeFileSync(authorPath, YAML.stringify({
    ...existingAuthor,
    id: author.id,
    name: author.name
  }));
}

function saveTalk(talk) {
  const monthName = month === 10 ? 'october' : 'april';
  const talkDir = join(confDir, `${year}-${monthName}`);
  if (!existsSync(talkDir)) {
    mkdirSync(talkDir);
  }
  const talkPath = join(talkDir, `${talk.id}.yml`);
  writeFileSync(talkPath, YAML.stringify(talk));
  console.log(`wrote ${talkPath}`);
}
