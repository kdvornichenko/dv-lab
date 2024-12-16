import { DateValue } from "@internationalized/date";
import { ApiError, Event, TokenClient } from "@/types/google.types";
import { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import useGoogleApiStore from "@/store/googleApi.store";

class GoogleApiService {
  private tokenClient: TokenClient | null = null;

  constructor(
    private CLIENT_ID: string,
    private API_KEY: string,
    private DISCOVERY_DOC: string,
    private SCOPES: string
  ) { }

  async initializeClient(router: AppRouterInstance): Promise<boolean> {
    try {
      await this.loadGoogleScripts();
      await this.initGapiClient();

      this.tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: this.CLIENT_ID,
        scope: this.SCOPES,
        callback: (resp) => {
          if (resp.error) {
            console.error("Authorization error:", resp.error);
            router.push("/login");
          } else {
            localStorage.setItem("gapi_token", resp.access_token);
          }
        },
      });

      return true;
    } catch (error) {
      this.handleError(error as ApiError, "Error initializing Google API client", router);
      return false;
    }
  }

  async initializeClientWithSession(token: string): Promise<void> {
    try {
      await this.loadGoogleScripts();
      await this.initGapiClient();
      window.gapi.client.setToken({ access_token: token });
    } catch (error) {
      console.error("Error initializing client with session token:", error);
      throw error;
    }
  }

  requestAccessToken(): void {
    const { setAlert } = useGoogleApiStore.getState();

    if (!this.tokenClient) {
      console.error("Token client not initialized");
      setAlert("Token client not initialized! Wait 5 sec...");
      return;
    }

    console.log("Requesting access token...");
    this.tokenClient.requestAccessToken();
  }

  async fetchEvents(
    dateRange: { start: DateValue | null; end: DateValue | null },
    router: AppRouterInstance,
    summary?: string
  ): Promise<Event[]> {
    if (!window.gapi?.client) {
      console.error("Google API client is not initialized.");
      throw new Error("Google API client is not initialized.");
    }

    try {
      const timeMin = dateRange.start?.toDate("UTC").toISOString();
      let timeMax: string | undefined;

      if (dateRange.end) {
        const endDateJs = dateRange.end.toDate("UTC");
        const endDatePlusOne = new Date(
          endDateJs.getTime() + 24 * 60 * 60 * 1000
        );
        timeMax = endDatePlusOne.toISOString();
      }

      const response = await window.gapi.client.calendar.events.list({
        calendarId: "primary",
        timeMin,
        timeMax,
        showDeleted: false,
        singleEvents: true,
        orderBy: "startTime",
        maxResults: 500,
        q: summary,
      });
      const events = response.result.items;
      const filteredEvents = events?.filter(event => event.summary === summary)

      return (summary ? filteredEvents : events) as Event[];
    } catch (error) {
      this.handleError(error as ApiError, "Error fetching events", router);
      throw error;
    }
  }

  private async initGapiClient(): Promise<void> {
    if (!window.gapi?.load) {
      throw new Error("Google API script is not loaded.");
    }

    return new Promise<void>((resolve, reject) => {
      window.gapi.load("client", async () => {
        try {
          await window.gapi.client.init({
            apiKey: this.API_KEY,
            discoveryDocs: [this.DISCOVERY_DOC],
          });
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  private async loadGoogleScripts(): Promise<void> {
    await Promise.all([
      this.loadGoogleScript("https://apis.google.com/js/api.js", "gapi"),
      this.loadGoogleScript("https://accounts.google.com/gsi/client", "google"),
    ]);
  }

  private loadGoogleScript(src: string, globalKey: keyof Window & string): Promise<void> {
    if (window[globalKey as keyof Window]) return Promise.resolve();

    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () =>
        reject(new Error(`Failed to load Google script: ${src}`));
      document.body.appendChild(script);
    });
  }

  private handleError(
    error: ApiError,
    message: string,
    router?: AppRouterInstance
  ): void {
    if (error.status === 401) {
      router?.push("/login");
    } else {
      console.error(`${message}:`, error);
    }
  }
}

export default GoogleApiService;
