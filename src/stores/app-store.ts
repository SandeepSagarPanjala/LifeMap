import {create} from 'zustand';
import {persist, createJSONStorage} from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

type AppState = {
  hasCompletedPrivacyOnboarding: boolean;
  completePrivacyOnboarding: () => void;
};

export const useAppStore = create<AppState>()(
  persist(
    set => ({
      hasCompletedPrivacyOnboarding: false,
      completePrivacyOnboarding: () => set({hasCompletedPrivacyOnboarding: true}),
    }),
    {
      name: 'lifemap-app',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: state => ({
        hasCompletedPrivacyOnboarding: state.hasCompletedPrivacyOnboarding,
      }),
    }
  )
);
