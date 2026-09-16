import unittest
from unittest.mock import patch
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent))
from news_feed import parse_news, latest_news, _cache


class NewsTests(unittest.TestCase):
    def test_publisher_metadata_and_chronology(self):
        xml = '''<rss xmlns:media="http://search.yahoo.com/mrss/"><channel>
        <item><title>Older</title><description>&lt;b&gt;Publisher summary&lt;/b&gt;</description><link>https://www.trthaber.com/haber/older</link><pubDate>Tue, 15 Sep 2026 10:00:00 +0300</pubDate><media:content url="https://example.com/older.jpg"/></item>
        <item><title>Latest</title><description>Actual description</description><link>https://www.trthaber.com/haber/latest</link><pubDate>Wed, 16 Sep 2026 10:00:00 +0300</pubDate><media:content url="https://example.com/latest.jpg"/></item>
        <item><title>No date</title><description>Invalid article</description><link>https://www.trthaber.com/haber/invalid</link><media:content url="https://example.com/latest.jpg"/></item>
        <item><title>Ancient</title><description>Old</description><link>https://www.trthaber.com/haber/ancient</link><pubDate>Wed, 16 Sep 2020 10:00:00 +0300</pubDate><media:content url="https://example.com/latest.jpg"/></item>
        </channel></rss>'''
        from datetime import datetime
        items = parse_news(xml, datetime.fromisoformat('2026-09-16T18:00:00+03:00').timestamp())
        self.assertEqual([x['title'] for x in items], ['Latest', 'Older'])
        self.assertEqual(items[1]['summary'], 'Publisher summary')
        self.assertEqual(items[0]['image_url'], 'https://example.com/latest.jpg')
        self.assertEqual(items[0]['url'], 'https://www.trthaber.com/haber/latest')

    def test_outage_does_not_invent_news(self):
        previous = dict(_cache)
        try:
            _cache.update(items=[], checked=0, updated=0, error=None)
            with patch('news_feed.urlopen', side_effect=OSError('offline')):
                items, meta = latest_news()
            self.assertEqual(items, [])
            self.assertTrue(meta['degraded'])
            self.assertFalse(meta['ok'])
        finally:
            _cache.update(previous)


if __name__ == '__main__':
    unittest.main()
