import {StackActions, type NavigationContainerRef} from '@react-navigation/native';
import {AppState, Linking, Platform} from 'react-native';

import type {RootStackParamList} from '@/navigation/types';

import {consumePendingWidgetAction} from './native-widget-snapshot';

export type WidgetAction = 'note' | 'photo' | 'voice' | 'activity' | 'refresh';

export type WidgetSheetHandlers = {
  closeSheets: () => void;
  openVoice: () => void;
  openActivity: () => void;
  refresh: () => void;
};

const WIDGET_ACTIONS = new Set<WidgetAction>([
  'note',
  'photo',
  'voice',
  'activity',
  'refresh',
]);

let navigationRef: NavigationContainerRef<RootStackParamList> | null = null;
let sheetHandlers: WidgetSheetHandlers | null = null;
let pendingAction: WidgetAction | null = null;
let draining = false;
let lastExecutedAction: WidgetAction | null = null;
let lastExecutedAt = 0;

function isWidgetAction(value: string): value is WidgetAction {
  return WIDGET_ACTIONS.has(value as WidgetAction);
}

export function parseWidgetDeepLink(url: string): WidgetAction | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'lifemap:') {
      return null;
    }

    const host = parsed.hostname;
    const path = parsed.pathname;

    if (host === 'capture' && path === '/note') {
      return 'note';
    }
    if (host === 'capture' && path === '/photo') {
      return 'photo';
    }
    if (path === '/capture/note') {
      return 'note';
    }
    if (path === '/capture/photo') {
      return 'photo';
    }
    if (host === 'map' || path === '/map') {
      const action = parsed.searchParams.get('widgetAction');
      if (action != null && isWidgetAction(action)) {
        return action;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function registerWidgetSheetHandlers(next: WidgetSheetHandlers | null): void {
  sheetHandlers = next;
  if (sheetHandlers != null) {
    void drainPendingWidgetAction();
  }
}

export function setWidgetNavigationRef(
  ref: NavigationContainerRef<RootStackParamList> | null,
): void {
  navigationRef = ref;
  if (ref?.isReady() === true) {
    void drainPendingWidgetAction();
  }
}

function queueWidgetAction(action: WidgetAction): void {
  pendingAction = action;
  void drainPendingWidgetAction();
}

export function queueWidgetDeepLink(url: string): void {
  const action = parseWidgetDeepLink(url);
  if (action != null) {
    queueWidgetAction(action);
  }
}

function shouldSkipDuplicate(action: WidgetAction): boolean {
  const now = Date.now();
  if (action === lastExecutedAction && now - lastExecutedAt < 1000) {
    return true;
  }
  lastExecutedAction = action;
  lastExecutedAt = now;
  return false;
}

function applyWidgetAction(action: WidgetAction): void {
  if (navigationRef?.isReady() !== true || sheetHandlers == null) {
    pendingAction = action;
    return;
  }

  if (shouldSkipDuplicate(action)) {
    return;
  }

  sheetHandlers.closeSheets();

  const state = navigationRef.getRootState();
  const top = state.routes[state.index];
  const targetScreen =
    action === 'note' ? 'CaptureNote' : action === 'photo' ? 'CapturePhoto' : null;

  if (targetScreen != null && top?.name === targetScreen) {
    return;
  }

  if (state.index > 0) {
    navigationRef.dispatch(StackActions.popToTop());
  }

  if (action === 'note') {
    navigationRef.navigate('CaptureNote');
    return;
  }
  if (action === 'photo') {
    navigationRef.navigate('CapturePhoto');
    return;
  }
  if (action === 'voice') {
    sheetHandlers.openVoice();
    return;
  }
  if (action === 'activity') {
    sheetHandlers.openActivity();
    return;
  }
  sheetHandlers.refresh();
}

async function readNativePendingAction(): Promise<WidgetAction | null> {
  const action = await consumePendingWidgetAction();
  if (action != null && isWidgetAction(action)) {
    return action;
  }
  return null;
}

async function drainPendingWidgetAction(): Promise<void> {
  if (draining) {
    return;
  }
  draining = true;
  try {
    const nativeAction = Platform.OS === 'ios' ? await readNativePendingAction() : null;
    const action = nativeAction ?? pendingAction;
    if (action == null) {
      return;
    }

    pendingAction = null;
    applyWidgetAction(action);
  } finally {
    draining = false;
  }
}

export function startWidgetDeepLinkListening(): () => void {
  const subscriptions: Array<{remove: () => void}> = [];

  if (Platform.OS !== 'ios') {
    void Linking.getInitialURL().then(url => {
      if (url != null) {
        queueWidgetDeepLink(url);
      }
    });

    subscriptions.push(
      Linking.addEventListener('url', event => {
        const url = typeof event === 'string' ? event : event.url;
        if (url != null) {
          queueWidgetDeepLink(url);
        }
      }),
    );
  }

  subscriptions.push(
    AppState.addEventListener('change', nextState => {
      if (nextState === 'active') {
        void drainPendingWidgetAction();
      }
    }),
  );

  return () => {
    for (const subscription of subscriptions) {
      subscription.remove();
    }
  };
}
