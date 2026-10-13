import type { MentionBinding } from '@dv-lab/contracts'

type MarkNode = {
	type: string
	value?: string
	children?: MarkNode[]
	position?: { start: { offset?: number }; end: { offset?: number } }
	data?: { hName?: string; hProperties?: Record<string, unknown> }
}

export const MENTION_TAG = 'student-mention'

const CARET_CLASS = 'ml-0.5 inline-block h-4 w-0.5 translate-y-[3px] bg-foreground motion-safe:animate-pulse'

function textNode(value: string): MarkNode {
	return { type: 'text', value }
}

function splitText(node: MarkNode, mentions: readonly MentionBinding[]): MarkNode[] {
	const start = node.position?.start.offset
	const end = node.position?.end.offset
	const value = node.value
	if (start === undefined || end === undefined || value === undefined || end - start !== value.length) return [node]
	const inside = mentions
		.filter((binding) => binding.start >= start && binding.end <= end)
		.sort((left, right) => left.start - right.start)
	if (inside.length === 0) return [node]
	const parts: MarkNode[] = []
	let cursor = start
	for (const binding of inside) {
		if (binding.start < cursor) continue
		if (binding.start > cursor) parts.push(textNode(value.slice(cursor - start, binding.start - start)))
		parts.push({
			type: 'studentMention',
			data: { hName: MENTION_TAG, hProperties: { studentId: binding.studentId } },
			children: [textNode(value.slice(binding.start - start, binding.end - start))],
		})
		cursor = binding.end
	}
	if (cursor < end) parts.push(textNode(value.slice(cursor - start)))
	return parts
}

function markMentions(node: MarkNode, mentions: readonly MentionBinding[]) {
	if (node.children === undefined) return
	const next: MarkNode[] = []
	for (const child of node.children) {
		if (child.type === 'text') next.push(...splitText(child, mentions))
		else {
			markMentions(child, mentions)
			next.push(child)
		}
	}
	node.children = next
}

function addCaret(tree: MarkNode) {
	let node = tree
	for (;;) {
		const last = node.children?.at(-1)
		if (last === undefined) break
		if (last.type === 'list' || last.type === 'listItem' || last.type === 'blockquote') {
			node = last
			continue
		}
		if (last.type === 'paragraph' || last.type === 'heading') {
			node = last
			break
		}
		return
	}
	node.children = [
		...(node.children ?? []),
		{ type: 'caret', data: { hName: 'span', hProperties: { className: CARET_CLASS, ariaHidden: 'true' } } },
	]
}

export function remarkMarks(options: { mentions: readonly MentionBinding[]; caret: boolean }) {
	return (tree: MarkNode) => {
		if (options.mentions.length > 0) markMentions(tree, options.mentions)
		if (options.caret) addCaret(tree)
	}
}
