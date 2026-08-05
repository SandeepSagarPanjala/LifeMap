import {
  StackActions,
  type NavigationContainerRef,
} from '@react-navigation/native';
import { Linking, Platform } from 'react-native';

import type { RootStackParamList } from '@/navigation/types';

import { consumePendingWidgetAction } from './native-widget-snapshot';

export type WidgetAction = 'note' | 'photo' | 'voice' | 'activity' | 'refresh';

export type WidgetSheetHandlers = {
  refresh: () => void;
};

const WIDGET_ACTIONS = new Set<WidgetAction>([
  'note',
  'photo',
  'voice',
  'activity',
  'refresh',
]);

type CaptureScreenName =
  | 'CaptureNote'
  | 'CapturePhoto'
  | 'CaptureVoice'
  | 'CaptureActivity';

const CAPTURE_SCREEN_BY_ACTION: Partial<
  Record<WidgetAction, CaptureScreenName>
> = {
  note: 'CaptureNote',
  photo: 'CapturePhoto',
  voice: 'CaptureVoice',
  activity: 'CaptureActivity',
};

export function isWidgetCaptureAction(
  action: WidgetAction | null | undefined,
): action is 'note' | 'photo' | 'voice' | 'activity' {
  return (
    action === 'note' ||
    action === 'photo' ||
    action === 'voice' ||
    action === 'activity'
  );
}

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
    if (host === 'capture' && path === '/voice') {
      return 'voice';
    }
    if (host === 'capture' && path === '/activity') {
      return 'activity';
    }
    if (path === '/capture/note') {
      return 'note';
    }
    if (path === '/capture/photo') {
      return 'photo';
    }
    if (path === '/capture/voice') {
      return 'voice';
    }
    if (path === '/capture/activity') {
      return 'activity';
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

export function registerWidgetSheetHandlers(
  next: WidgetSheetHandlers | null,
): void {
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

/** True when the root stack's focused screen is Map (not Settings / You / capture / …). */
export function isRootMapScreenActive(): boolean {
  if (navigationRef == null || !navigationRef.isReady()) {
    return false;
  }
  const state = navigationRef.getRootState();
  if (state == null || state.routes.length === 0) {
    return false;
  }
  const top = state.routes[state.index];
  return top?.name === 'Map';
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
  if (navigationRef?.isReady() !== true) {
    pendingAction = action;
    return;
  }

  if (shouldSkipDuplicate(action)) {
    return;
  }

  const targetScreen = CAPTURE_SCREEN_BY_ACTION[action];
  if (targetScreen != null) {
    const state = navigationRef.getRootState();
    const top = state.routes[state.index];
    if (top?.name === targetScreen) {
      return;
    }
    if (state.index > 0) {
      navigationRef.dispatch(StackActions.popToTop());
    }
    navigationRef.navigate(targetScreen);
    return;
  }

  if (action === 'refresh') {
    if (sheetHandlers == null) {
      pendingAction = action;
      return;
    }
    sheetHandlers.refresh();
  }
}

export function dispatchWidgetAction(action: WidgetAction): void {
  applyWidgetAction(action);
}

async function readNativePendingAction(): Promise<WidgetAction | null> {
  const action = await consumePendingWidgetAction();
  if (action != null && isWidgetAction(action)) {
    return action;
  }
  return null;
}

/** Take pending widget action without applying (AppBootstrap FG decides defer vs full). */
export async function takePendingWidgetAction(): Promise<WidgetAction | null> {
  if (draining) {
    return null;
  }
  draining = true;
  try {
    const nativeAction =
      Platform.OS === 'ios' ? await readNativePendingAction() : null;
    const action = nativeAction ?? pendingAction;
    pendingAction = null;
    return action;
  } finally {
    draining = false;
  }
}

async function drainPendingWidgetAction(): Promise<void> {
  const action = await takePendingWidgetAction();
  if (action == null) {
    return;
  }
  applyWidgetAction(action);
}

export function startWidgetDeepLinkListening(): () => void {
  const subscriptions: Array<{ remove: () => void }> = [];

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

  // FG drain is owned by AppBootstrap (with deferred heavy resume for capture).

  return () => {
    for (const subscription of subscriptions) {
      subscription.remove();
    }
  };
}
