import { useCallback, useEffect, useMemo, useState } from 'react';

import { dateKeyForTimestamp } from '../../lib/export';
import { buildMobileDayHistory } from '../../mobile/build-mobile-day';
import { countHistoryTimelineEvents } from '../../mobile/history-ruler';
import { firstPlayableTimelineIndex } from '../../mobile/timeline-nav';
import type {
  MomentRow,
  ParsedPoint,
  PlaceLookupRow,
  SavedPlaceRow,
} from '../../types';
import { MobileDateNav } from './MobileDateNav';
import { MobileEventCard } from './MobileEventCard';
import { MobileHistoryButton } from './MobileHistoryButton';
import { MobileMap } from './MobileMap';
import { MobileTimelineBar } from './MobileTimelineBar';

import './mobile.css';

type MobileScreenProps = {
  dateKey: string;
  dateKeys: readonly string[];
  allPoints: readonly ParsedPoint[];
  savedPlaces: readonly SavedPlaceRow[];
  placeLookupCache: readonly PlaceLookupRow[];
  moments: readonly MomentRow[];
  onDateChange: (dateKey: string) => void;
};

export function MobileScreen({
  dateKey,
  dateKeys,
  allPoints,
  savedPlaces,
  placeLookupCache,
  moments,
  onDateChange,
}: MobileScreenProps) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const history = useMemo(
    () =>
      buildMobileDayHistory(
        dateKey,
        allPoints,
        savedPlaces,
        placeLookupCache,
        moments,
      ),
    [allPoints, dateKey, moments, placeLookupCache, savedPlaces],
  );

  const eventCount = countHistoryTimelineEvents(history.entries);
  const emptyDay = history.dayPoints.length === 0;
  const dayIndex = dateKeys.indexOf(dateKey);
  const todayKey = useMemo(
    () => dateKeyForTimestamp(new Date().toISOString()),
    [],
  );
  const viewingToday = dateKey === todayKey;
  const canGoPrevDay = dayIndex > 0;
  const canGoNextDay =
    !viewingToday && dayIndex >= 0 && dayIndex < dateKeys.length - 1;

  const goPrevDay = () => {
    if (canGoPrevDay) {
      setSelectedIndex(-1);
      onDateChange(dateKeys[dayIndex - 1]!);
    }
  };

  const goNextDay = () => {
    if (canGoNextDay) {
      setSelectedIndex(-1);
      onDateChange(dateKeys[dayIndex + 1]!);
    }
  };

  const goToToday = () => {
    setSelectedIndex(-1);
    const todayInExport = dateKeys.includes(todayKey);
    onDateChange(todayInExport ? todayKey : dateKeys[dateKeys.length - 1]!);
  };

  const handlePanelClose = () => {
    setPanelOpen(false);
    setSelectedIndex(-1);
    if (!viewingToday) {
      goToToday();
    }
  };

  const openHistoryPanel = useCallback(() => {
    setSelectedIndex(firstPlayableTimelineIndex(history.entries));
    setPanelOpen(true);
  }, [history.entries]);

  useEffect(() => {
    if (!panelOpen || history.entries.length === 0) {
      return;
    }
    if (selectedIndex < 0) {
      setSelectedIndex(firstPlayableTimelineIndex(history.entries));
    }
  }, [history.entries, panelOpen, selectedIndex]);

  const selectedEntry =
    selectedIndex >= 0 ? history.entries[selectedIndex] ?? null : null;
  const showHistoryMap =
    panelOpen && selectedIndex >= 0 && selectedEntry != null;
  const showSavedPlaceMarkersOnMap =
    showHistoryMap || !viewingToday || history.dayPoints.length > 0;

  return (
    <div className="mobile-screen">
      <div className="mobile-map-layer">
        <MobileMap
          entries={history.entries}
          dayPoints={history.dayPoints}
          savedPlaces={savedPlaces}
          selectedIndex={selectedIndex}
          showSavedPlaceMarkersOnMap={showSavedPlaceMarkersOnMap}
        />
      </div>

      <div className="mobile-floating-controls" aria-hidden={panelOpen}>
        {!panelOpen ? (
          <>
            <MobileDateNav
              anchor="map"
              dateKey={dateKey}
              todayKey={todayKey}
              canGoPrev={canGoPrevDay}
              canGoNext={canGoNextDay}
              showCloseButton={!viewingToday}
              onPrev={goPrevDay}
              onNext={goNextDay}
              onClose={goToToday}
            />
            <MobileHistoryButton
              eventCount={eventCount}
              onPress={openHistoryPanel}
            />
          </>
        ) : null}
      </div>

      {panelOpen ? (
        <div className="mobile-history-dock">
          <div className="mobile-panel-chrome">
            <MobileDateNav
              anchor="panel"
              dateKey={dateKey}
              todayKey={todayKey}
              canGoPrev={canGoPrevDay}
              canGoNext={canGoNextDay}
              showCloseButton
              closeLabel={viewingToday ? 'Close history' : 'Return to today'}
              onPrev={goPrevDay}
              onNext={goNextDay}
              onClose={handlePanelClose}
            />
          </div>

          <div className="mobile-history-panel-content">
            <MobileEventCard
              entry={selectedEntry}
              savedPlaces={savedPlaces}
              scrubOnEmpty={
                !emptyDay && history.entries.length > 0 && selectedIndex < 0
              }
              emptyDayWithoutData={emptyDay}
            />

            <MobileTimelineBar
              dateKey={dateKey}
              entries={history.entries}
              selectedIndex={selectedIndex}
              onSelectIndex={setSelectedIndex}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
