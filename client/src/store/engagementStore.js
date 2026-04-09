import { create } from 'zustand';
import { engagementApi, metadataApi } from '../api/client';

const useEngagementStore = create((set, get) => ({
  // Current engagement context
  currentEngagement:    null,
  isLoading:            false,
  error:                null,

  // Stats for sidebar badges
  stats:                null,
  pendingApprovals:     0,

  // Load an engagement by ID (called when navigating to /engagements/:id)
  loadEngagement: async (id) => {
    if (get().currentEngagement?.engagement_id === id && !get().error) return;
    set({ isLoading: true, error: null });
    try {
      const [engRes, statsRes, approvalRes] = await Promise.all([
        engagementApi.get(id),
        engagementApi.stats(id),
        metadataApi.count(id),
      ]);
      set({
        currentEngagement: engRes.data,
        stats:             statsRes.data,
        pendingApprovals:  approvalRes.data.pending,
        isLoading:         false,
      });
    } catch (err) {
      set({ error: err.message, isLoading: false });
    }
  },

  // Patch the current engagement locally (after an update)
  patchEngagement: (data) => {
    set(state => ({
      currentEngagement: state.currentEngagement
        ? { ...state.currentEngagement, ...data }
        : null,
    }));
  },

  // Refresh stats + approval count (call after findings/approvals change)
  refreshStats: async () => {
    const id = get().currentEngagement?.engagement_id;
    if (!id) return;
    try {
      const [statsRes, approvalRes] = await Promise.all([
        engagementApi.stats(id),
        metadataApi.count(id),
      ]);
      set({ stats: statsRes.data, pendingApprovals: approvalRes.data.pending });
    } catch {}
  },

  clearEngagement: () => set({ currentEngagement: null, stats: null, pendingApprovals: 0, error: null }),
}));

export default useEngagementStore;
