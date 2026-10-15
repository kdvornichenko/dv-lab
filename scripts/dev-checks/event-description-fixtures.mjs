export const ZOOM_LINK = 'https://example-zoom.test/j/12345678901?pwd=FixtureCode.1&from=addon'
export const ZOOM_PLACE = 'https://example-zoom.test/j/12345678901?pwd=FixtureCode.1#success'

const zoomRaw = [
	'<p>──────────<br/><br/>',
	'Fixture Teacher is inviting you to a scheduled Zoom meeting.<br/><br/>',
	'Join Zoom Meeting<br/>',
	'https://example-zoom.test/j/12345678901?pwd=FixtureCode.1&amp;from=addon<br/><br/>',
	'Meeting ID: 123 4567 8901<br/>',
	'Passcode: 000000<br/><br/>',
	'---<br/><br/>',
	'One tap mobile<br/>',
	'+15550100123,,12345678901# US<br/><br/>',
	'Dial by your location<br/>',
	'&nbsp;&nbsp;&nbsp;&nbsp;+84 24 0000 0000,,12345678901# Vietnam<br/>',
	'&nbsp;&nbsp;&nbsp;&nbsp;+1 555 0100 0124 US<br/><br/>',
	'Phone: +15550100123<br/><br/>',
	'Find your local number: https://example-zoom.test/u/abcdef<br/><br/>',
	'──────────</p>',
].join('')

export const descriptionFixtures = [
	{
		id: 'zoom',
		raw: zoomRaw,
		location: ZOOM_PLACE,
		expect: {
			formatted: true,
			first: 'divider',
			last: 'divider',
			hrefs: [ZOOM_LINK, 'tel:+15550100123', 'https://example-zoom.test/u/abcdef'],
			plain: ['+15550100123,,12345678901# US', '+84 24 0000 0000,,12345678901# Vietnam', '---', 'Passcode: 000000'],
			absent: ['<p', '<br', '&nbsp;', '&amp;'],
		},
	},
	{
		id: 'plain',
		raw: 'Lesson notes for the week.\n\n\n\nRead chapter 2: https://example.test/reading.\r\nBring the workbook.\n\n',
		location: 'Clinic room 4, 12 Example Street',
		expect: {
			formatted: false,
			kinds: ['paragraph', 'paragraph'],
			breaks: 1,
			hrefs: ['https://example.test/reading'],
			plain: ['Lesson notes for the week.', 'Bring the workbook.'],
			absent: ['\r'],
		},
	},
	{
		id: 'tags-only',
		raw: '<p>&nbsp;</p><div><br/></div><p> </p>\n<div>&nbsp;&nbsp;</div>',
		location: null,
		expect: { formatted: true, kinds: [], hrefs: [] },
	},
]
