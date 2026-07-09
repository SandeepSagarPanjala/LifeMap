import type { SegmentMomentCounts } from '@lifemap/segmentation';

import { MobileMomentIcon } from './MobileMomentIcon';
import { mobileMomentIconSvg } from './mobile-moment-icon-svg';
import {
  hasMobileMomentCounts,
  MOBILE_MOMENT_CHIP_ORDER,
  MOBILE_MOMENT_THEMES,
} from './mobile-moment-theme';

type MobileMomentCountsRowProps = {
  counts: SegmentMomentCounts;
  /** Map callout uses smaller stacked chips. */
  dense?: boolean;
};

export function MobileMomentCountsRow({
  counts,
  dense = false,
}: MobileMomentCountsRowProps) {
  if (!hasMobileMomentCounts(counts)) {
    return null;
  }

  return (
    <div
      className={
        dense
          ? 'mobile-moment-counts-row mobile-moment-counts-row-dense'
          : 'mobile-moment-counts-row'
      }
    >
      {MOBILE_MOMENT_CHIP_ORDER.map(definition => {
        const count = counts[definition.type];
        if (count <= 0) {
          return null;
        }
        const theme = MOBILE_MOMENT_THEMES[definition.themeKey];
        return (
          <div
            key={definition.type}
            className="mobile-moment-count-chip"
            aria-label={`${definition.label}: ${count}`}
          >
            <span
              className="mobile-moment-count-orb"
              style={{ backgroundColor: theme.badgeBg }}
            >
              <MobileMomentIcon
                type={definition.type}
                size={dense ? 12 : 14}
                color={theme.icon}
              />
            </span>
            <span className="mobile-moment-count-number">{count}</span>
          </div>
        );
      })}
    </div>
  );
}

export function mobileMomentCountsHtml(
  counts: SegmentMomentCounts,
  dense = false,
): string {
  if (!hasMobileMomentCounts(counts)) {
    return '';
  }

  const chips = MOBILE_MOMENT_CHIP_ORDER.flatMap(definition => {
    const count = counts[definition.type];
    if (count <= 0) {
      return [];
    }
    const theme = MOBILE_MOMENT_THEMES[definition.themeKey];
    return [
      `<div class="mobile-moment-count-chip${
        dense ? ' mobile-moment-count-chip-dense' : ''
      }">` +
        `<span class="mobile-moment-count-orb" style="background:${theme.badgeBg}">` +
        mobileMomentIconSvg(definition.type, theme.icon, dense ? 12 : 14) +
        `</span>` +
        `<span class="mobile-moment-count-number">${count}</span>` +
        `</div>`,
    ];
  }).join('');

  return (
    `<div class="mobile-moment-counts-row${
      dense ? ' mobile-moment-counts-row-dense' : ''
    }">${chips}</div>` + `<div class="mobile-stay-bubble-moment-divider"></div>`
  );
}
