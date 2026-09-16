"""Publisher-provided news metadata; never synthesize publication dates or images."""
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from html.parser import HTMLParser
from threading import Lock
from urllib.parse import urlparse
from urllib.request import Request, urlopen
import time
import xml.etree.ElementTree as ET

FEED_URL = 'https://www.trthaber.com/ekonomi_articles.rss'
_cache = {'items': [], 'checked': 0, 'updated': 0, 'error': None}
_lock = Lock()


class PlainText(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []

    def handle_data(self, data):
        self.parts.append(data)


def plain(value):
    parser = PlainText()
    parser.feed(value or '')
    return ' '.join(' '.join(parser.parts).split())


def parse_news(xml, timestamp):
    items, seen = [], set()
    for node in ET.fromstring(xml).findall('.//item'):
        url = (node.findtext('link') or '').strip()
        try:
            published = parsedate_to_datetime(node.findtext('pubDate') or '')
            epoch = published.timestamp()
        except (TypeError, ValueError, OverflowError):
            continue
        if not timestamp - 7 * 86400 <= epoch <= timestamp + 300:
            continue
        if urlparse(url).hostname != 'www.trthaber.com' or url in seen:
            continue
        title = plain(node.findtext('title'))
        summary = plain(node.findtext('description'))
        media = node.find('{http://search.yahoo.com/mrss/}content')
        image = media.get('url', '') if media is not None else ''
        if not title or not summary or urlparse(image).scheme != 'https':
            continue
        seen.add(url)
        items.append({'id': url, 'title': title, 'summary': summary,
                      'body': summary, 'image_url': image, 'url': url,
                      'source': 'TRT Haber', 'author': node.findtext('author') or 'TRT Haber',
                      'published_at': published.isoformat(), 'published_ts': epoch,
                      'kind': 'Ekonomi'})
    return sorted(items, key=lambda item: item['published_ts'], reverse=True)


def latest_news():
    with _lock:
        current = time.time()
        if current - _cache['checked'] >= 120:
            _cache['checked'] = current
            try:
                request = Request(FEED_URL, headers={'User-Agent': 'Ottoman/1.0'})
                with urlopen(request, timeout=8) as response:
                    items = parse_news(response.read(2_000_000), current)
                if not items:
                    raise ValueError('No recent publisher articles')
                _cache.update(items=items, updated=current, error=None)
            except (OSError, ValueError, ET.ParseError) as error:
                _cache['error'] = type(error).__name__
        items = [item for item in _cache['items'] if item['published_ts'] >= current - 7 * 86400]
        return items, {'ok': bool(items) and not _cache['error'],
                       'degraded': bool(_cache['error']), 'count': len(items),
                       'updated_at_label': datetime.fromtimestamp(_cache['updated'], timezone.utc).isoformat() if _cache['updated'] else None,
                       'sources': [{'name': 'TRT Haber', 'url': FEED_URL}],
                       'errors': [_cache['error']] if _cache['error'] else []}
