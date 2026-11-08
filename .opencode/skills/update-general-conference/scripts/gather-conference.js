// Browser-side gatherer for the update-general-conference skill.
//
// Run with Chrome DevTools MCP evaluate_script, with the page on
// https://www.churchofjesuschrist.org. Set `uri` to the conference you want.
//
// The result is JSON-serializable and is consumed by generate-conference.mjs.

async () => {
  // Change this to the conference you are adding.
  const uri = '/general-conference/2026/04';

  const API =
    'https://www.churchofjesuschrist.org/study/api/v3/language-pages/type/content?lang=eng&uri=';

  const text = (el) =>
    el ? el.textContent.replace(/\s+/g, ' ').trim() : '';

  const getJson = async (pageUri) => {
    const res = await fetch(API + pageUri);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${pageUri}`);
    return res.json();
  };

  const parseStructuredDate = (meta) => {
    try {
      const raw = meta?.structuredData;
      const data = typeof raw === 'string' ? JSON.parse(raw) : raw || {};
      return data.datePublished || null;
    } catch {
      return null;
    }
  };

  const getDuration = (url) =>
    new Promise((resolve) => {
      if (!url) return resolve(null);

      const audio = new Audio();
      let done = false;

      const finish = (value) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        audio.removeAttribute('src');
        audio.load();
        resolve(value);
      };

      const timer = setTimeout(() => finish(null), 20000);

      audio.addEventListener(
        'loadedmetadata',
        () => {
          const seconds = Math.floor(audio.duration);
          finish(Number.isFinite(seconds) && seconds > 0 ? seconds : null);
        },
        { once: true }
      );

      audio.addEventListener('error', () => finish(null), { once: true });

      audio.preload = 'metadata';
      audio.src = url;
    });

  const mapLimit = async (items, limit, fn) => {
    const out = new Array(items.length);
    let next = 0;

    const worker = async () => {
      while (next < items.length) {
        const index = next++;
        out[index] = await fn(items[index], index);
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(limit, items.length) }, worker)
    );
    return out;
  };

  const conference = await getJson(uri);
  const doc = new DOMParser().parseFromString(
    conference.content.body,
    'text/html'
  );

  const nav = doc.querySelector('nav');
  if (!nav) throw new Error('Could not find the conference nav');

  const sessions = [];
  const talkRefs = [];

  // The nav is: nav > ul > li[data-content-type=general-conference-session]
  // Each session li contains a link to the session and a nested ul of talks.
  const sessionItems = [...nav.querySelectorAll(':scope > ul > li')];

  sessionItems.forEach((li, sessionIndex) => {
    const index = sessionIndex + 1;
    const labelText =
      text(li.querySelector(':scope > h2 .title')) || `Session ${index}`;
    const label = labelText.replace(/\s+Session$/i, '');
    const sessionLink = li.querySelector(':scope > ul > li > a');
    const description = text(sessionLink?.querySelector('.description'));

    sessions.push({
      index,
      label,
      text: labelText,
      href: (sessionLink?.getAttribute('href') || '').split('?')[0],
      description,
    });

    // Only talk/business items carry data-content-type. The first nested li is
    // the session link itself and is deliberately skipped.
    const anchors = [
      ...li.querySelectorAll(':scope > ul > li[data-content-type] > a'),
    ];

    anchors.forEach((anchor, talkIndex) => {
      talkRefs.push({
        session: index,
        sequence: talkIndex + 1,
        href: (anchor.getAttribute('href') || '').split('?')[0],
        navSpeaker: text(anchor.querySelector('.primaryMeta')),
        navTitle: text(anchor.querySelector('.title')),
      });
    });
  });

  if (!talkRefs.length) throw new Error('No talks found in the conference nav');

  const talks = await mapLimit(talkRefs, 5, async (ref) => {
    const talkUri = ref.href.replace('/study', '');
    const talk = await getJson(talkUri);
    const talkDoc = new DOMParser().parseFromString(
      talk.content.body,
      'text/html'
    );

    const header = talkDoc.querySelector('header');
    const title = text(header?.querySelector('h1')) || ref.navTitle;
    const authorName = text(header?.querySelector('.byline .author-name'));
    const authorRole = text(header?.querySelector('.byline .author-role'));
    const summary = text(header?.querySelector('.kicker'));
    const audio = talk.meta?.audio?.[0]?.mediaUrl || null;
    const datePublished = parseStructuredDate(talk.meta);
    const duration = await getDuration(audio);

    if (!authorName) throw new Error(`Missing byline for ${ref.href}`);
    if (!datePublished) {
      throw new Error(`Missing datePublished for ${ref.href}`);
    }
    if (!audio) throw new Error(`Missing audio for ${ref.href}`);

    return {
      ...ref,
      title,
      authorName,
      authorRole,
      summary,
      audio,
      datePublished,
      duration,
    };
  });

  return {
    uri,
    title: text(doc.querySelector('header h1')),
    sessions,
    talks,
  };
}
