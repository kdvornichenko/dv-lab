import { create } from 'zustand';

interface FetchState {
    isLoading: boolean;
    setLoading: (loading: boolean) => void;
}

const useFetchStore = create<FetchState>((set) => ({
    isLoading: false,
    setLoading: (loading) => set({ isLoading: loading }),
}));

export default useFetchStore;
