export type ApiError = {
    status: number;
};

export type TokenClient = {
    requestAccessToken: () => void;
};

export type Event = {
    id: string
    summary?: string
    start: { dateTime: string; date: string }
    end: { dateTime: string; date: string }
    htmlLink?: string
}

export type Gapi = {
    client: {
        init: (config: { apiKey: string; discoveryDocs: string[] }) => Promise<void>;
        calendar: {
            events: {
                list: (params: {
                    calendarId: string;
                    timeMin?: string;
                    timeMax?: string;
                    showDeleted: boolean;
                    singleEvents: boolean;
                    orderBy: string;
                }) => Promise<{
                    result: {
                        items: Event[];
                    };
                }>;
            };
        };
        setToken: (token: { access_token: string }) => void;
    };
    load: (name: string, callback: () => void) => void;
};
