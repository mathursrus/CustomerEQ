import { create } from 'zustand'

interface UIState {
  activeSheet: 'survey' | 'cluster' | 'review' | 'create' | null
  selectedSurveyId: string | null
  selectedClusterId: string | null
  selectedReviewId: string | null
  openSheet: (sheet: UIState['activeSheet'], id?: string) => void
  closeSheet: () => void
}

export const useUIStore = create<UIState>((set) => ({
  activeSheet: null,
  selectedSurveyId: null,
  selectedClusterId: null,
  selectedReviewId: null,
  openSheet: (sheet, id) => set((state) => ({
    activeSheet: sheet,
    selectedSurveyId: sheet === 'survey' ? (id ?? null) : state.selectedSurveyId,
    selectedClusterId: sheet === 'cluster' ? (id ?? null) : state.selectedClusterId,
    selectedReviewId: sheet === 'review' ? (id ?? null) : state.selectedReviewId,
  })),
  closeSheet: () => set({ activeSheet: null }),
}))
