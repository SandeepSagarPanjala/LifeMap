import {WIDGET_CAPTURE_LINKS} from '@/lib/widget/types';

describe('widget deep links', () => {
  it('defines capture and refresh links', () => {
    expect(WIDGET_CAPTURE_LINKS.note).toBe('lifemap://capture/note');
    expect(WIDGET_CAPTURE_LINKS.photo).toBe('lifemap://capture/photo');
    expect(WIDGET_CAPTURE_LINKS.voice).toBe('lifemap://map?widgetAction=voice');
    expect(WIDGET_CAPTURE_LINKS.activity).toBe('lifemap://map?widgetAction=activity');
    expect(WIDGET_CAPTURE_LINKS.refresh).toBe('lifemap://map?widgetAction=refresh');
  });
});
