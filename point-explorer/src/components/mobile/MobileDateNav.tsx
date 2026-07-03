import {formatMapDateLabel} from '../../mobile/timeline-format';

type MobileDateNavProps = {
  dateKey: string;
  todayKey: string;
  canGoPrev: boolean;
  canGoNext: boolean;
  showCloseButton?: boolean;
  closeLabel?: string;
  anchor?: 'map' | 'panel';
  onPrev: () => void;
  onNext: () => void;
  onClose?: () => void;
};

export function MobileDateNav({
  dateKey,
  todayKey,
  canGoPrev,
  canGoNext,
  showCloseButton = false,
  closeLabel = 'Return to today',
  anchor = 'map',
  onPrev,
  onNext,
  onClose,
}: MobileDateNavProps) {
  const label = formatMapDateLabel(dateKey, todayKey);
  const wrapClass =
    anchor === 'map' ? 'mobile-map-date-nav' : 'mobile-panel-date-nav-wrap';

  return (
    <div className={wrapClass} role="toolbar" aria-label={`Map showing ${label}`}>
      {showCloseButton ? (
        <button
          type="button"
          className="mobile-panel-close mobile-panel-close-red mobile-map-date-close"
          aria-label={closeLabel}
          onClick={() => onClose?.()}>
          ×
        </button>
      ) : null}
      <div
        className={
          showCloseButton
            ? 'mobile-panel-date-row mobile-map-date-row-spaced'
            : 'mobile-panel-date-row'
        }>
        <button
          type="button"
          className="mobile-panel-date-circle"
          disabled={!canGoPrev}
          aria-label="Previous day"
          onClick={onPrev}>
          ‹
        </button>
        <span className="mobile-panel-date-pill">{label}</span>
        <button
          type="button"
          className="mobile-panel-date-circle"
          disabled={!canGoNext}
          aria-label="Next day"
          onClick={onNext}>
          ›
        </button>
      </div>
    </div>
  );
}
