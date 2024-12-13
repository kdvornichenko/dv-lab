import { create } from 'zustand';

interface GoogleApiState {
    isLoading: boolean;
    setLoading: (loading: boolean) => void;
    isAlertActive: boolean;
    alertMessage: string | null;
    setAlert: (message: string) => void;
}

const useGoogleApiStore = create<GoogleApiState>((set) => ({
    isLoading: false,
    setLoading: (loading) => set({ isLoading: loading }),

    isAlertActive: false,
    alertMessage: null,

    setAlert: (message) => {
        set({ alertMessage: message, isAlertActive: true });

        // Автоматически сбрасываем через 5 секунд
        setTimeout(() => {
            set({ isAlertActive: false });
            setTimeout(() => {
                set({ alertMessage: null });
            }, 1000);
        }, 5000);
    },
}));

export default useGoogleApiStore;
