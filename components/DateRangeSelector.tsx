import React, { FC } from 'react'
import { CalendarDate, DateValue } from '@internationalized/date'
import { DateRangePicker } from '@heroui/date-picker'
interface DateRangeSelectorProps {
	dateRange: { start: DateValue | null; end: DateValue | null }
	onChange: (range: { start: DateValue | null; end: DateValue | null }) => void
}

const DateRangeSelector: FC<DateRangeSelectorProps> = ({
	dateRange,
	onChange,
}) => {
	return (
		<DateRangePicker
			showMonthAndYearPickers
			variant='bordered'
			className='flex-1'
			aria-labelledby='Date range selector'
			calendarProps={{
				classNames: {
					headerWrapper: 'pt-4 bg-background',
					prevButton: 'border-1 border-default-200 rounded-small',
					nextButton: 'border-1 border-default-200 rounded-small',
					gridHeader: 'bg-background shadow-none border-b-1 border-default-100',
					cellButton: [
						'data-[today=true]:bg-default-100 data-[selected=true]:bg-transparent rounded-small',
						// start (pseudo)
						'data-[range-start=true]:before:rounded-l-small',
						'data-[selection-start=true]:before:rounded-l-small',
						// end (pseudo)
						'data-[range-end=true]:before:rounded-r-small',
						'data-[selection-end=true]:before:rounded-r-small',
						// start (selected)
						'data-[selected=true]:data-[selection-start=true]:data-[range-selection=true]:rounded-small',
						// end (selected)
						'data-[selected=true]:data-[selection-end=true]:data-[range-selection=true]:rounded-small',
					],
				},
			}}
			value={{
				start: dateRange.start as unknown as CalendarDate,
				end: dateRange.end as unknown as CalendarDate,
			}}
			onChange={(value) => onChange({
				start: value?.start as DateValue | null,
				end: value?.end as DateValue | null,
			})}
		/>
	)
}

export default DateRangeSelector
