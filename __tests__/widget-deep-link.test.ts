import {parseWidgetDeepLink} from '@/lib/widget/widget-deep-link';
import {WIDGET_CAPTURE_LINKS} from '@/lib/widget/types';

describe('parseWidgetDeepLink', () => {
  it('parses diary capture link', () => {
    expect(parseWidgetDeepLink(WIDGET_CAPTURE_LINKS.note)).toBe('note');
  });

  it('parses photo capture link', () => {
    expect(parseWidgetDeepLink(WIDGET_CAPTURE_LINKS.photo)).toBe('photo');
  });

  it('parses map widget actions', () => {
    expect(parseWidgetDeepLink(WIDGET_CAPTURE_LINKS.voice)).toBe('voice');
    expect(parseWidgetDeepLink(WIDGET_CAPTURE_LINKS.activity)).toBe('activity');
    expect(parseWidgetDeepLink(WIDGET_CAPTURE_LINKS.refresh)).toBe('refresh');
  });

  it('ignores unrelated URLs', () => {
    expect(parseWidgetDeepLink('https://example.com')).toBeNull();
    expect(parseWidgetDeepLink('lifemap://unknown')).toBeNull();
  });
});
