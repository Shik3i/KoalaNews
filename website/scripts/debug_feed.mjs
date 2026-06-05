import Parser from 'rss-parser';

async function main() {
  const parser = new Parser();
  const url = 'https://feeds.bbci.co.uk/news/rss.xml';
  const feed = await parser.parseURL(url);
  console.log('Feed title:', feed.title);
  console.log('Item count:', feed.items.length);
  if (feed.items.length > 0) {
    console.log('Sample item:', JSON.stringify(feed.items[0], null, 2));
  }
}

main().catch(console.error);
