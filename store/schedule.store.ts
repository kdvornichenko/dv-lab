import { create } from 'zustand';

interface FetchState {
    isLoading: boolean;
    setIsLoading: (loading: boolean) => void;
}

const useFetchStore = create<FetchState>((set) => ({
    isLoading: false,
    setIsLoading: (loading) => set({ isLoading: loading }),
}));

export default useFetchStore;
