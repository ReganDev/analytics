import { mergeAttributes, Node, NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from '@tiptap/react'

export const DEFAULT_NOTE_TITLE = 'Get urgent help if'

/** In-editor look of the note: an editable heading above editable text. */
function NoteView({ node, updateAttributes }: ReactNodeViewProps) {
  return (
    <NodeViewWrapper as="aside" className="note">
      <input
        className="note__title"
        value={node.attrs.title ?? ''}
        placeholder="Heading (optional)"
        aria-label="Note heading"
        onChange={(event) => updateAttributes({ title: event.target.value })}
      />
      <NodeViewContent className="note__body" />
    </NodeViewWrapper>
  )
}

/**
 * The shaded "Get urgent help if…" panel. Stored as
 * { type: 'note', attrs: { title }, content: [paragraph…] } and rendered by
 * each client site as its .article__note panel.
 */
export const Note = Node.create({
  name: 'note',
  group: 'block',
  content: 'paragraph+',
  defining: true,
  isolating: true,

  addAttributes() {
    return { title: { default: DEFAULT_NOTE_TITLE } }
  },

  parseHTML() {
    return [{ tag: 'aside[data-note]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['aside', mergeAttributes(HTMLAttributes, { 'data-note': '' }), 0]
  },

  addNodeView() {
    return ReactNodeViewRenderer(NoteView)
  },
})
