/** Stable accessibility labels for Saved places e2e — keep in sync with app UI. */
module.exports = {
  MAP_PIN: 'Open saved places',
  DISMISS_SHEET: 'Dismiss sheet',
  LIST_HEADING: 'Saved places',
  /** Shown above the list when at least one place is saved. */
  LIST_HAS_ROWS_HINT:
    'Long-press the map to add Home, Work, or a Favorite.',
  HOME_LABEL: 'Home',
  WORK_LABEL: 'Work',
  /** Visible link text at bottom of the list. */
  ADD_BY_ADDRESS: 'Add by address',
  ADD_BY_ADDRESS_LINK: 'Add saved place by address',
  ADD_BY_ADDRESS_FORM: 'Add saved place by address form',
  ADDRESS_FIELD: 'Saved place address',
  LOOKUP_ADDRESS: 'Look up address',
  CANCEL_ADD: 'Cancel add by address',
  MARK_AS_HOME: 'Mark as Home',
  MARK_AS_WORK: 'Mark as Work',
  ADD_FAVORITE_KIND: 'Add Favorite',
  NEW_FAVORITE_NAME: 'New favorite name',
  SAVE_BY_ADDRESS: 'Save saved place by address',
  RENAME_PANEL: 'Rename favorite',
  RENAMED_FAVORITE_NAME: 'Renamed favorite name',
  SAVE_RENAME: 'Save favorite name',
  CANCEL_RENAME: 'Cancel rename',
  ALERT_REMOVE: 'Remove',
  ALERT_CANCEL: 'Cancel',
  /** RN Alert.alert body when deleting a saved place. */
  ALERT_REMOVE_MESSAGE:
    'Visits here will show times only, without this label.',
  /** Alert title — `Remove ${placeLabel}?` from SavedPlacesSheet.confirmDelete. */
  alertRemoveTitle: placeLabel => `Remove ${placeLabel}?`,
  /** Geocodes reliably on iOS simulator; requires network. */
  GEOCODE_HOME: '1600 Amphitheatre Parkway, Mountain View, CA',
  GEOCODE_WORK: '2211 North First Street, San Jose, CA',
  GEOCODE_FAVORITE: '1 Infinite Loop, Cupertino, CA',
  /** Legacy default — same as favorite address. */
  GEOCODE_ADDRESS: '1 Infinite Loop, Cupertino, CA',
};
