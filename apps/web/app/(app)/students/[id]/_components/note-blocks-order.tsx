'use client'

import { useEffect, useRef, useState, type FocusEvent, type KeyboardEvent, type ReactNode } from 'react'

import { Reorder, useDragControls, useReducedMotion } from 'motion/react'
import { GripVertical } from 'lucide-react'

import { Banner, BannerAction, BannerActions, BannerTitle } from '@/components/ui/banner'
import { Button } from '@/components/ui/button'
import { Tooltip } from '@/components/ui/tooltip'
import { apiRequest } from '@/lib/api-client'
import { spring } from '@/lib/springs'

import { reorderBlocksResponse, type NoteBlock } from '@dv-lab/contracts'

export interface BlockSlot {
	index: number
	count: number
	lifted: boolean
	ordering: boolean
	handle: ReactNode
	moveBy: (delta: -1 | 1) => void
}

interface NoteBlocksOrderProps {
	studentId: string
	blocks: NoteBlock[]
	onBlocks: (blocks: NoteBlock[]) => void
	onReloadBlocks: () => Promise<NoteBlock[] | null>
	renderBlock: (block: NoteBlock, slot: BlockSlot) => ReactNode
}

interface OrderedItemProps {
	id: string
	alone: boolean
	locked: boolean
	lifted: boolean
	handleRef: (element: HTMLButtonElement | null) => void
	onHandleKey: (event: KeyboardEvent<HTMLButtonElement>) => void
	onHandleBlur: (event: FocusEvent<HTMLButtonElement>) => void
	onDragStart: () => void
	onDragEnd: () => void
	children: (raised: boolean, handle: ReactNode) => ReactNode
}

function sameOrder(left: readonly string[], right: readonly string[]): boolean {
	return left.length === right.length && left.every((id, index) => id === right[index])
}

function OrderedItem({
	id,
	alone,
	locked,
	lifted,
	handleRef,
	onHandleKey,
	onHandleBlur,
	onDragStart,
	onDragEnd,
	children,
}: OrderedItemProps) {
	const controls = useDragControls()
	const reduceMotion = useReducedMotion() ?? false
	const [dragging, setDragging] = useState(false)
	const raised = dragging || lifted
	const handle = alone ? null : (
		<Tooltip content="Drag to reorder" side="top">
			<Button
				ref={handleRef}
				type="button"
				variant="ghost"
				size="icon-compact"
				aria-label="Reorder block"
				aria-pressed={lifted}
				disabled={locked}
				data-slot="block-handle"
				className="-ml-2 h-7 w-6 cursor-grab touch-none text-muted-foreground active:cursor-grabbing max-sm:hidden"
				onPointerDown={(event) => {
					if (!locked) controls.start(event)
				}}
				onKeyDown={onHandleKey}
				onBlur={onHandleBlur}
			>
				<GripVertical />
			</Button>
		</Tooltip>
	)
	return (
		<Reorder.Item
			as="li"
			value={id}
			layout="position"
			dragListener={false}
			dragControls={controls}
			animate={{ scale: raised ? 1.01 : 1 }}
			transition={reduceMotion ? { duration: 0 } : spring.moderate}
			style={{ position: 'relative', zIndex: raised ? 1 : 0 }}
			onDragStart={() => {
				setDragging(true)
				onDragStart()
			}}
			onDragEnd={() => {
				setDragging(false)
				onDragEnd()
			}}
			className="list-none"
			data-slot="block-item"
		>
			{children(raised, handle)}
		</Reorder.Item>
	)
}

export function NoteBlocksOrder({ studentId, blocks, onBlocks, onReloadBlocks, renderBlock }: NoteBlocksOrderProps) {
	const [order, setOrder] = useState<string[] | null>(null)
	const orderRef = useRef<string[] | null>(null)
	const [saving, setSaving] = useState(false)
	const savingRef = useRef(false)
	const [lift, setLift] = useState<{ id: string; snapshot: string[] } | null>(null)
	const [message, setMessage] = useState('')
	const [failedIds, setFailedIds] = useState<string[] | null>(null)
	const [retrying, setRetrying] = useState(false)
	const handles = useRef(new Map<string, HTMLButtonElement>())
	const dragging = useRef<string | null>(null)

	const committed = blocks.map((block) => block.id)
	const present = new Set(committed)
	const ids =
		order === null
			? committed
			: [...order.filter((id) => present.has(id)), ...committed.filter((id) => !order.includes(id))]
	const byId = new Map(blocks.map((block) => [block.id, block]))

	function setOrdering(next: string[] | null) {
		orderRef.current = next
		setOrder(next)
	}

	async function commit(next: string[], source: NoteBlock[], movedId: string | null) {
		if (savingRef.current) return
		const base = source.map((block) => block.id)
		const wanted = next.filter((id) => base.includes(id))
		if (sameOrder(wanted, base)) {
			setOrdering(null)
			return
		}
		const revisions = new Map(source.map((block) => [block.id, block.revision]))
		savingRef.current = true
		setSaving(true)
		setFailedIds(null)
		const result = await apiRequest<unknown>('PUT', `/students/${studentId}/blocks/order`, {
			blocks: wanted.map((id) => ({ id, expectedRevision: revisions.get(id) })),
		})
		const parsed = result.ok ? reorderBlocksResponse.safeParse(result.data) : null
		savingRef.current = false
		setSaving(false)
		if (parsed?.success) {
			onBlocks(parsed.data.blocks)
			setOrdering(null)
			const moved = movedId === null ? undefined : source.find((block) => block.id === movedId)
			if (moved) {
				const position = wanted.indexOf(moved.id) + 1
				setMessage(`${moved.name} moved to position ${position} of ${wanted.length}.`)
			}
			return
		}
		setOrdering(null)
		setFailedIds(wanted)
		setMessage('Could not save the order. The list is back as it was.')
	}

	async function retry() {
		if (failedIds === null || retrying) return
		setRetrying(true)
		const fresh = await onReloadBlocks()
		if (fresh !== null) {
			const kept = failedIds.filter((id) => fresh.some((block) => block.id === id))
			const rest = fresh.map((block) => block.id).filter((id) => !kept.includes(id))
			await commit([...kept, ...rest], fresh, null)
		}
		setRetrying(false)
	}

	function moveBy(id: string, delta: -1 | 1) {
		const index = ids.indexOf(id)
		const target = index + delta
		if (index < 0 || target < 0 || target >= ids.length) return
		const next = [...ids]
		next.splice(index, 1)
		next.splice(target, 0, id)
		setOrdering(next)
		void commit(next, blocks, id)
	}

	function onHandleKey(id: string, event: KeyboardEvent<HTMLButtonElement>) {
		if (saving) return
		const index = ids.indexOf(id)
		const name = byId.get(id)?.name ?? 'Block'
		if (event.key === ' ' || event.key === 'Enter') {
			event.preventDefault()
			if (lift === null) {
				if (event.key !== ' ') return
				setLift({ id, snapshot: ids })
				setMessage(`${name} lifted, position ${index + 1} of ${ids.length}.`)
				return
			}
			setLift(null)
			void commit(orderRef.current ?? ids, blocks, id)
			return
		}
		if (lift?.id !== id) return
		if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
			event.preventDefault()
			const target = index + (event.key === 'ArrowUp' ? -1 : 1)
			if (target < 0 || target >= ids.length) return
			const next = [...ids]
			next.splice(index, 1)
			next.splice(target, 0, id)
			setOrdering(next)
			setMessage(`${name}, position ${target + 1} of ${ids.length}.`)
		} else if (event.key === 'Escape') {
			event.preventDefault()
			setOrdering(null)
			setLift(null)
			setMessage('Reorder cancelled.')
		}
	}

	function onHandleBlur(id: string, event: FocusEvent<HTMLButtonElement>) {
		if (lift?.id !== id || event.relatedTarget === null) return
		setOrdering(null)
		setLift(null)
	}

	useEffect(() => {
		if (lift === null) return
		const element = handles.current.get(lift.id)
		if (element && document.activeElement !== element) element.focus({ preventScroll: true })
	}, [lift, order])

	return (
		<div className="flex flex-col gap-3">
			{failedIds !== null ? (
				<Banner status="warning" role="alert" data-slot="block-order-failed">
					<BannerTitle>Could not save the order. The list is back as it was.</BannerTitle>
					<BannerActions className="col-start-2 row-start-2 my-0 mt-2 ml-0">
						<BannerAction loading={retrying} onClick={() => void retry()}>
							Try again
						</BannerAction>
					</BannerActions>
				</Banner>
			) : null}
			<Reorder.Group
				as="ul"
				axis="y"
				values={ids}
				onReorder={setOrdering}
				className="flex flex-col gap-3"
				data-slot="block-list"
			>
				{ids.map((id, index) => {
					const block = byId.get(id)
					if (!block) return null
					return (
						<OrderedItem
							key={id}
							id={id}
							alone={ids.length <= 1}
							locked={saving}
							lifted={lift?.id === id}
							handleRef={(element) => {
								if (element) handles.current.set(id, element)
								else handles.current.delete(id)
							}}
							onHandleKey={(event) => onHandleKey(id, event)}
							onHandleBlur={(event) => onHandleBlur(id, event)}
							onDragStart={() => {
								dragging.current = id
							}}
							onDragEnd={() => {
								const moved = dragging.current
								dragging.current = null
								void commit(orderRef.current ?? committed, blocks, moved)
							}}
						>
							{(raised, handle) =>
								renderBlock(block, {
									index,
									count: ids.length,
									lifted: raised,
									ordering: saving,
									handle,
									moveBy: (delta) => moveBy(id, delta),
								})
							}
						</OrderedItem>
					)
				})}
			</Reorder.Group>
			<p role="status" aria-live="polite" className="sr-only">
				{message}
			</p>
		</div>
	)
}
