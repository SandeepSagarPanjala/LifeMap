type MobileHistoryButtonProps = {
  eventCount: number;
  onPress: () => void;
};

export function MobileHistoryButton({
  eventCount,
  onPress,
}: MobileHistoryButtonProps) {
  const badgeLabel = eventCount > 99 ? '99+' : String(eventCount);

  return (
    <button
      type="button"
      className="mobile-history-fab"
      aria-label={
        eventCount > 0 ? `Show ${eventCount} history events` : 'Show history'
      }
      onClick={onPress}>
      <svg
        className="mobile-history-fab-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden>
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
        <path d="M3 3v5h5" />
      </svg>
      {eventCount > 0 ? (
        <span className="mobile-history-fab-badge">{badgeLabel}</span>
      ) : null}
    </button>
  );
}
