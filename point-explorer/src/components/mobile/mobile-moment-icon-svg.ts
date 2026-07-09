import type { MobileMomentCountType } from './mobile-moment-theme';

export function mobileMomentIconSvg(
  type: MobileMomentCountType,
  color: string,
  size: number,
): string {
  const attrs = `width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"`;

  if (type === 'photo') {
    return `<svg ${attrs}><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>`;
  }
  if (type === 'video') {
    return `<svg ${attrs}><path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5"/><rect x="2" y="6" width="14" height="12" rx="2"/></svg>`;
  }
  if (type === 'voice') {
    return `<svg ${attrs}><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>`;
  }
  if (type === 'note') {
    return `<svg ${attrs}><path d="M13 21h8"/><path d="M12 21V7a2 2 0 0 1 2-2h5v16"/><path d="M12 7H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h5"/></svg>`;
  }
  return `<svg ${attrs}><path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/></svg>`;
}
