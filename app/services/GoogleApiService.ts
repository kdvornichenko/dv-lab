import { DateValue } from '@internationalized/date';
import { ApiError, Event, TokenClient } from '@/types/google.types';

class GoogleApiService {
  private tokenClient: TokenClient | null = null;

  constructor(
    private CLIENT_ID: string,
    private API_KEY: string,
    private DISCOVERY_DOC: string,
    private SCOPES: string
  ) { }

  initializeClient(callback: (isAuthorized: boolean) => void) {
    console.log('Initializing Google API client...');
    Promise.all([this.loadGoogleAPIScript(), this.loadGoogleIdentityScript()])
      .then(() => {
        window.gapi.load('client', async () => {
          await window.gapi.client.init({
            apiKey: this.API_KEY,
            discoveryDocs: [this.DISCOVERY_DOC || ''],
          });

          this.tokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: this.CLIENT_ID,
            scope: this.SCOPES || '',
            callback: resp => {
              if (resp.error) {
                console.error('Authorization error:', resp.error);
                callback(false);
                return;
              }
              console.log('Authorized successfully');
              localStorage.setItem('gapi_token', resp.access_token);
              callback(true);
            },
          });

          console.log('Google API client initialized');
        });
      })
      .catch(error => {
        console.error('Error initializing Google API client:', error);
        callback(false);
      });
  }

  initializeClientWithToken(token: string, callback: (isAuthorized: boolean) => void) {
    console.log('Initializing Google API client with token...');
    Promise.all([this.loadGoogleAPIScript(), this.loadGoogleIdentityScript()])
      .then(() => {
        window.gapi.load('client', async () => {
          await window.gapi.client.init({
            apiKey: this.API_KEY,
            discoveryDocs: [this.DISCOVERY_DOC || ''],
          });
          window.gapi.client.setToken({ access_token: token });
          console.log('Token set successfully');
          callback(true);
        });
      })
      .catch(error => {
        console.error('Error initializing client with token:', error);
        callback(false);
      });
  }


  private loadGoogleAPIScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof window.gapi !== 'undefined') {
        console.log('Google API script already loaded.');
        return resolve();
      }
      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.onload = () => {
        console.log('Google API script loaded');
        resolve();
      };
      script.onerror = () => reject(new Error('Failed to load Google API script'));
      document.body.appendChild(script);
    });
  }

  private loadGoogleIdentityScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof window.google !== 'undefined' && window.google.accounts) {
        console.log('Google Identity Services script already loaded.');
        return resolve();
      }
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.onload = () => {
        console.log('Google Identity Services script loaded');
        resolve();
      };
      script.onerror = () => reject(new Error('Failed to load Google Identity Services script'));
      document.body.appendChild(script);
    });
  }

  requestAccessToken() {
    if (!this.tokenClient) {
      console.error('Token client not initialized');
      return;
    }
    console.log('Requesting access token...');
    this.tokenClient.requestAccessToken();
  }

  async fetchEvents(dateRange: { start: DateValue | null; end: DateValue | null }): Promise<Event[]> {
    try {
      console.log('Fetching events from Google Calendar...');

      const timeMin = dateRange.start?.toDate('UTC').toISOString();
      let timeMax: string | undefined = undefined;
      if (dateRange.end) {
        const endDateJs = dateRange.end.toDate('UTC');
        const endDatePlusOne = new Date(endDateJs.getTime() + 24 * 60 * 60 * 1000);
        timeMax = endDatePlusOne.toISOString();
      }

      const response = await window.gapi.client.calendar.events.list({
        calendarId: 'primary',
        timeMin,
        timeMax,
        showDeleted: false,
        singleEvents: true,
        orderBy: 'startTime',
      });

      return response.result.items as Event[];
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'status' in error) {
        const apiError = error as ApiError;
        if (apiError.status === 401) {
          alert('Unauthorized, please log in again.')
          console.error('Unauthorized, please log in again.');
          throw new Error('Unauthorized');
        }
      }
      console.error('Unknown error:', error);
      throw error;
    }
  }

  async fetchEventsBySummaryAndDateRange(summary: string, dateRange: { start: DateValue | null; end: DateValue | null }): Promise<Event[]> {
    const allEvents = await this.fetchEvents(dateRange);
    return allEvents.filter(event => event.summary === summary);
  }
}

export default GoogleApiService;
