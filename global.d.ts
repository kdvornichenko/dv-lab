import { Gapi } from "./types/google.types";

declare global {
  interface Window {
    gapi: Gapi;
    google: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (resp: { error?: string; access_token: string }) => void;
          }) => TokenClient;
        };
      };
    };
  }
}


export { };
