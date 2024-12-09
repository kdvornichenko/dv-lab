import React, { FC } from 'react';
import { DateRangePicker, CalendarDate } from '@nextui-org/react';
import { DateValue } from '@internationalized/date';

interface DateRangeSelectorProps {
  dateRange: { start: DateValue | null; end: DateValue | null };
  onChange: (range: { start: DateValue | null; end: DateValue | null }) => void;
}

const DateRangeSelector: FC<DateRangeSelectorProps> = ({ dateRange, onChange }) => {
  return (
    <DateRangePicker
      showMonthAndYearPickers
      variant='bordered'
      className='max-w-md'
      value={{
        start: dateRange.start as unknown as CalendarDate,
        end: dateRange.end as unknown as CalendarDate,
      }}
      onChange={onChange}
    />
  );
};

export default DateRangeSelector;
