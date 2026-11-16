import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Theme = 'dark' | 'light'

type ThemeState = {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggle: () => void
}

function apply(theme: Theme) {
  document.documentElement.dataset.theme = theme
}

export const useTheme = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      setTheme: (theme) => {
        apply(theme)
        set({ theme })
      },
      toggle: () => get().setTheme(get().theme === 'dark' ? 'light' : 'dark'),
    }),
    {
      name: 'meridian-theme',
      onRehydrateStorage: () => (state) => {
        if (state) apply(state.theme)
      },
    },
  ),
)