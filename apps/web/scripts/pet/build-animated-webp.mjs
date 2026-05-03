#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import sharp from 'sharp'

function readArgs(argv) {
	const args = new Map()
	for (let index = 0; index < argv.length; index += 1) {
		const key = argv[index]
		if (!key.startsWith('--')) continue
		const value = argv[index + 1]
		if (!value || value.startsWith('--')) {
			args.set(key.slice(2), 'true')
			continue
		}
		args.set(key.slice(2), value)
		index += 1
	}
	return args
}

function requireArg(args, name) {
	const value = args.get(name)
	if (!value) throw new Error(`missing --${name}`)
	return value
}

function parseNumber(args, name, fallback) {
	const raw = args.get(name)
	if (!raw) return fallback
	const value = Number(raw)
	if (!Number.isFinite(value) || value <= 0) throw new Error(`invalid --${name}: ${raw}`)
	return value
}

function isLikelyBackground(red, green, blue) {
	const max = Math.max(red, green, blue)
	const min = Math.min(red, green, blue)
	const average = (red + green + blue) / 3
	return max - min <= 30 && average >= 225
}

async function cleanEdgeBackground(source) {
	const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
	const visited = new Uint8Array(info.width * info.height)
	const queue = []

	function push(x, y) {
		if (x < 0 || y < 0 || x >= info.width || y >= info.height) return
		const index = y * info.width + x
		if (visited[index]) return
		const offset = index * info.channels
		if (data[offset + 3] === 0 || isLikelyBackground(data[offset], data[offset + 1], data[offset + 2])) {
			visited[index] = 1
			queue.push(index)
		}
	}

	for (let x = 0; x < info.width; x += 1) {
		push(x, 0)
		push(x, info.height - 1)
	}
	for (let y = 0; y < info.height; y += 1) {
		push(0, y)
		push(info.width - 1, y)
	}

	for (let cursor = 0; cursor < queue.length; cursor += 1) {
		const index = queue[cursor]
		const x = index % info.width
		const y = Math.floor(index / info.width)
		push(x + 1, y)
		push(x - 1, y)
		push(x, y + 1)
		push(x, y - 1)
	}

	for (let index = 0; index < visited.length; index += 1) {
		if (visited[index]) data[index * info.channels + 3] = 0
	}

	return { data, info }
}

function findAlphaSegments(data, info) {
	const columnCounts = new Array(info.width).fill(0)
	for (let x = 0; x < info.width; x += 1) {
		let count = 0
		for (let y = 0; y < info.height; y += 1) {
			if (data[(y * info.width + x) * info.channels + 3] > 24) count += 1
		}
		columnCounts[x] = count
	}

	const segments = []
	let start = -1
	for (let x = 0; x < info.width; x += 1) {
		if (columnCounts[x] > 2 && start < 0) start = x
		if ((columnCounts[x] <= 2 || x === info.width - 1) && start >= 0) {
			const end = columnCounts[x] <= 2 ? x - 1 : x
			if (end - start > 30) segments.push([start, end])
			start = -1
		}
	}
	return segments
}

function findBox(data, info, segment) {
	let minX = info.width
	let minY = info.height
	let maxX = -1
	let maxY = -1

	for (let y = 0; y < info.height; y += 1) {
		for (let x = segment[0]; x <= segment[1]; x += 1) {
			if (data[(y * info.width + x) * info.channels + 3] <= 24) continue
			minX = Math.min(minX, x)
			minY = Math.min(minY, y)
			maxX = Math.max(maxX, x)
			maxY = Math.max(maxY, y)
		}
	}

	if (maxX < minX || maxY < minY) throw new Error(`empty segment ${segment.join('-')}`)
	return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
}

function makeChunk(id, payload) {
	const padding = payload.length & 1 ? 1 : 0
	const chunk = Buffer.alloc(8 + payload.length + padding)
	chunk.write(id, 0, 4, 'ascii')
	chunk.writeUInt32LE(payload.length, 4)
	payload.copy(chunk, 8)
	return chunk
}

function uint24(value) {
	const bytes = Buffer.alloc(3)
	bytes[0] = value & 255
	bytes[1] = (value >> 8) & 255
	bytes[2] = (value >> 16) & 255
	return bytes
}

function extractFrameChunks(webp) {
	if (webp.toString('ascii', 0, 4) !== 'RIFF' || webp.toString('ascii', 8, 12) !== 'WEBP') {
		throw new Error('frame is not a WebP RIFF file')
	}
	const chunks = []
	let offset = 12
	while (offset + 8 <= webp.length) {
		const id = webp.toString('ascii', offset, offset + 4)
		const size = webp.readUInt32LE(offset + 4)
		if (id === 'VP8 ' || id === 'VP8L' || id === 'ALPH') {
			chunks.push(webp.subarray(offset, offset + 8 + size + (size & 1)))
		}
		offset += 8 + size + (size & 1)
	}
	if (!chunks.length) throw new Error('frame WebP has no image chunks')
	return Buffer.concat(chunks)
}

function makeAnimatedWebp(frameWebps, width, height, delays) {
	const vp8x = Buffer.alloc(10)
	vp8x[0] = 0x12
	uint24(width - 1).copy(vp8x, 4)
	uint24(height - 1).copy(vp8x, 7)

	const anim = Buffer.alloc(6)
	anim.writeUInt16LE(0, 4)

	const chunks = [makeChunk('VP8X', vp8x), makeChunk('ANIM', anim)]
	for (let index = 0; index < frameWebps.length; index += 1) {
		const header = Buffer.alloc(16)
		uint24(0).copy(header, 0)
		uint24(0).copy(header, 3)
		uint24(width - 1).copy(header, 6)
		uint24(height - 1).copy(header, 9)
		uint24(delays[index] ?? delays[0]).copy(header, 12)
		// Replace the full canvas on every frame. Without these flags browsers
		// alpha-blend frames and the pet leaves a trail of previous poses.
		header[15] = 0b11
		chunks.push(makeChunk('ANMF', Buffer.concat([header, extractFrameChunks(frameWebps[index])])))
	}

	const body = Buffer.concat([Buffer.from('WEBP'), ...chunks])
	const riff = Buffer.alloc(8)
	riff.write('RIFF', 0, 4, 'ascii')
	riff.writeUInt32LE(body.length, 4)
	return Buffer.concat([riff, body])
}

async function main() {
	const args = readArgs(process.argv.slice(2))
	const source = path.resolve(requireArg(args, 'source'))
	const output = path.resolve(requireArg(args, 'output'))
	const preview = args.get('preview') ? path.resolve(args.get('preview')) : ''
	const expectedFrames = parseNumber(args, 'frames', 0)
	const frameWidth = parseNumber(args, 'frame-width', 370)
	const frameHeight = parseNumber(args, 'frame-height', 200)
	const fps = parseNumber(args, 'fps', 6)
	const frameDelay = Math.round(1000 / fps)
	const reverse = args.get('reverse') === 'true'

	const { data, info } = await cleanEdgeBackground(source)
	const segments = findAlphaSegments(data, info)
	if (expectedFrames && segments.length !== expectedFrames) {
		throw new Error(`expected ${expectedFrames} frame segments, found ${segments.length}`)
	}

	const boxes = segments.map((segment) => findBox(data, info, segment))
	const maxWidth = Math.max(...boxes.map((box) => box.width))
	const maxHeight = Math.max(...boxes.map((box) => box.height))
	const horizontalPadding = Math.min(40, Math.max(4, Math.round(frameWidth * 0.04)))
	const verticalPadding = Math.min(20, Math.max(4, Math.round(frameHeight * 0.04)))
	const scale = Math.min(
		1,
		(frameWidth - horizontalPadding * 2) / maxWidth,
		(frameHeight - verticalPadding * 2) / maxHeight
	)
	const cleanedPng = await sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } })
		.png()
		.toBuffer()

	const framePngs = []
	for (const box of boxes) {
		const sprite = await sharp(cleanedPng)
			.extract(box)
			.resize({
				width: Math.round(box.width * scale),
				height: Math.round(box.height * scale),
				fit: 'fill',
			})
			.png()
			.toBuffer()
		const metadata = await sharp(sprite).metadata()
		const frame = await sharp({
			create: {
				width: frameWidth,
				height: frameHeight,
				channels: 4,
				background: { r: 0, g: 0, b: 0, alpha: 0 },
			},
		})
			.composite([
				{
					input: sprite,
					left: Math.round((frameWidth - metadata.width) / 2),
					top: Math.max(0, Math.round(frameHeight - verticalPadding - metadata.height)),
				},
			])
			.png()
			.toBuffer()
		framePngs.push(frame)
	}

	const outputFramePngs = reverse ? [...framePngs].reverse() : framePngs

	if (preview) {
		fs.mkdirSync(path.dirname(preview), { recursive: true })
		await sharp({
			create: {
				width: frameWidth * outputFramePngs.length,
				height: frameHeight,
				channels: 4,
				background: { r: 0, g: 0, b: 0, alpha: 0 },
			},
		})
			.composite(outputFramePngs.map((input, index) => ({ input, left: index * frameWidth, top: 0 })))
			.png({ compressionLevel: 9 })
			.toFile(preview)
	}

	const frameWebps = []
	for (const framePng of outputFramePngs) {
		frameWebps.push(await sharp(framePng).webp({ lossless: true, effort: 6 }).toBuffer())
	}
	fs.mkdirSync(path.dirname(output), { recursive: true })
	fs.writeFileSync(
		output,
		makeAnimatedWebp(
			frameWebps,
			frameWidth,
			frameHeight,
			frameWebps.map(() => frameDelay)
		)
	)

	const metadata = await sharp(output, { animated: true }).metadata()
	console.log(
		JSON.stringify(
			{
				output,
				preview: preview || undefined,
				frames: metadata.pages,
				width: metadata.width,
				height: metadata.pageHeight ?? metadata.height,
				animatedHeight: metadata.height,
				delay: metadata.delay,
				hasAlpha: metadata.hasAlpha,
				reverse,
				segments,
				source,
			},
			null,
			2
		)
	)
}

main().catch((error) => {
	console.error(error)
	process.exit(1)
})
