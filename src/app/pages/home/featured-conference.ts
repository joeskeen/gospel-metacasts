import { capitalCase } from 'change-case';
import type { AvailableFeed } from '../browse/feeds.service';

export type ConferenceMonth = 'april' | 'october';

export interface ConferencePeriod {
  year: number;
  month: ConferenceMonth;
}

export interface ConferenceFeed extends ConferencePeriod {
  name: string;
  path: string;
}

export interface FeaturedNotice {
  message: string;
  linkText: string;
  href: string;
}

export interface FeaturedContent {
  type: 'scripture' | 'conference';
  badge: string;
  title: string;
  description: string;
  path: string;
  buttonText: string;
  notice?: FeaturedNotice;
}

export const GITHUB_NEW_ISSUE_URL = 'https://github.com/joeskeen/gospel-metacasts/issues/new';

/**
 * General conference is held on the first Saturday/Sunday of April and October.
 * Treat a conference as "occurred" once its first Saturday has started.
 */
export function getLatestOccurredConference(now = new Date()): ConferencePeriod {
  const year = now.getFullYear();

  if (now >= firstSaturdayOfMonth(year, 9)) {
    return { year, month: 'october' };
  }

  if (now >= firstSaturdayOfMonth(year, 3)) {
    return { year, month: 'april' };
  }

  return { year: year - 1, month: 'october' };
}

export function firstSaturdayOfMonth(year: number, monthIndex: number): Date {
  const firstOfMonth = new Date(year, monthIndex, 1);
  const daysUntilSaturday = (6 - firstOfMonth.getDay() + 7) % 7;
  return new Date(year, monthIndex, 1 + daysUntilSaturday);
}

export function conferenceSortKey(period: ConferencePeriod): number {
  return period.year * 2 + (period.month === 'october' ? 1 : 0);
}

export function parseConferenceFeed(feed: AvailableFeed): ConferenceFeed | null {
  const match = feed.name.match(/^(\d{4})-(04|10|april|october)$/i);
  if (!match) {
    return null;
  }

  const rawMonth = match[2].toLowerCase();
  const month: ConferenceMonth = rawMonth === '04' || rawMonth === 'april'
    ? 'april'
    : 'october';

  return {
    year: Number(match[1]),
    month,
    name: feed.name,
    path: feed.path
  };
}

export function getLatestAvailableConference(
  feeds: AvailableFeed[],
  latestOccurred: ConferencePeriod
): ConferenceFeed | null {
  // Only consider feeds for conferences that have actually happened; a feed
  // generated ahead of time should not be featured before the conference.
  return feeds
    .filter(feed => feed.type === 'general-conference')
    .map(parseConferenceFeed)
    .filter((feed): feed is ConferenceFeed => feed !== null)
    .filter(feed => conferenceSortKey(feed) <= conferenceSortKey(latestOccurred))
    .sort((a, b) => conferenceSortKey(b) - conferenceSortKey(a))[0] ?? null;
}

export function buildConferenceFeatured(
  conference: ConferencePeriod,
  latestOccurred: ConferencePeriod,
  showNotice: boolean,
  feedPath = `general-conference/${conference.year}-${conference.month}.rss`
): FeaturedContent {
  const monthName = capitalCase(conference.month);
  const content: FeaturedContent = {
    type: 'conference',
    badge: `${monthName} ${conference.year} General Conference`,
    title: `${monthName} General Conference`,
    description: 'Listen to the most recent available messages from Church leadership.',
    path: feedPath,
    buttonText: 'Copy Podcast Feed'
  };

  if (showNotice) {
    const expectedName = `${capitalCase(latestOccurred.month)} ${latestOccurred.year}`;
    content.notice = {
      message: `Looking for ${expectedName}?`,
      linkText: 'Report it as an issue on GitHub',
      href: `${GITHUB_NEW_ISSUE_URL}?title=${encodeURIComponent(
        `Missing feed for ${expectedName} General Conference`
      )}`
    };
  }

  return content;
}
