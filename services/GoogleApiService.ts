import { createClient } from '@supabase/supabase-js';
import { DateValue } from '@internationalized/date';
import { Event } from '@/types/google.types';
import { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import useGoogleApiStore from '@/store/googleApi.store';

// Инициализация Supabase клиента
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

class GoogleApiService {
  constructor() { }

  async fetchEvents(
    dateRange: { start: DateValue | null; end: DateValue | null },
    router: AppRouterInstance,
    summary?: string
  ): Promise<Event[]> {
    const { setAlert } = useGoogleApiStore.getState();

    // Получаем Google токен из текущей сессии
    const googleToken = await this.getGoogleTokenFromSupabase();
    if (!googleToken) {
      console.error('Google token not found for the current user.');
      setAlert('Google token not found. Please log in again.');
      router.push('/login');
      throw new Error('Google token not found.');
    }

    try {
      const timeMin = dateRange.start?.toDate('UTC').toISOString();
      let timeMax: string | undefined;

      if (dateRange.end) {
        const endDateJs = dateRange.end.toDate('UTC');
        const endDatePlusOne = new Date(endDateJs.getTime() + 24 * 60 * 60 * 1000);
        timeMax = endDatePlusOne.toISOString();
      }

      // Отправляем запрос к Google Calendar API
      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime&maxResults=500${summary ? `&q=${summary}` : ''}`,
        {
          headers: {
            Authorization: `Bearer ${googleToken}`, // Используем Google токен
            Accept: 'application/json',
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        console.error('Error fetching events from Google API:', error);
        throw new Error(error.error.message || 'Error fetching events.');
      }

      const data = await response.json();
      const events = data.items;

      // Фильтруем события по summary, если указано
      const filteredEvents = events?.filter((event: Event) => event.summary === summary);

      return (summary ? filteredEvents : events) as Event[];
    } catch (error) {

      console.error('Error fetching events:', error);
      setAlert(`Error fetching events: ${error}`);
      throw error;
    }
  }

  private async getGoogleTokenFromSupabase(): Promise<string | null> {
    const { data: session, error } = await supabase.auth.getSession();

    if (error || !session?.session) {
      console.error('Error fetching session from Supabase:', error);
      return null;
    }

    const googleToken = session.session.provider_token;
    return googleToken || null;
  }
}

export default GoogleApiService;
