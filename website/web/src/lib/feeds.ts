type FeedLike = {
  custom_title?: string | null;
  title?: string | null;
  url?: string | null;
};

const TITLE_SEPARATOR = /\s(?:-|–|\||:)\s/;
const MAX_LABEL_LENGTH = 34;

function shorten(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= MAX_LABEL_LENGTH) return trimmed;
  return `${trimmed.slice(0, MAX_LABEL_LENGTH - 1).trim()}…`;
}

function hostFromUrl(url?: string | null): string {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0] ?? url;
  }
}

export function feedLabel(feed: FeedLike): string {
  const custom = feed.custom_title?.trim();
  if (custom) return shorten(custom);

  const title = feed.title?.trim();
  if (title) {
    const [firstPart] = title.split(TITLE_SEPARATOR);
    const label = firstPart?.trim() || title;
    return shorten(label);
  }

  return shorten(hostFromUrl(feed.url) || 'Feed');
}
