import { create } from 'zustand';

const useUIStore = create((set) => ({
  // Global notification/toast
  toast: null,
  showToast: (message, type = 'info') => {
    set({ toast: { message, type, id: Date.now() } });
    setTimeout(() => set({ toast: null }), 4000);
  },
  clearToast: () => set({ toast: null }),

  // Modal state
  activeModal: null,
  modalProps:  {},
  openModal:   (name, props = {}) => set({ activeModal: name, modalProps: props }),
  closeModal:  ()                 => set({ activeModal: null, modalProps: {} }),

  // Sidebar collapsed state (persisted to localStorage)
  sidebarCollapsed: localStorage.getItem('sidebar_collapsed') === 'true',
  toggleSidebar: () => set(state => {
    const next = !state.sidebarCollapsed;
    localStorage.setItem('sidebar_collapsed', String(next));
    return { sidebarCollapsed: next };
  }),
}));

export default useUIStore;
