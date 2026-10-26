import { EditorContent, useEditor, useEditorState, type Editor, type JSONContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { DEFAULT_NOTE_TITLE, Note } from './NoteNode'

/**
 * The article editor. Deliberately limited to what the client sites render:
 * paragraphs, two heading levels, bold, italic, lists, quotes, links and the
 * highlighted note. Anything else pasted in is dropped.
 */
const extensions = [
  StarterKit.configure({
    heading: { levels: [2, 3] },
    code: false,
    codeBlock: false,
    strike: false,
    underline: false,
    horizontalRule: false,
    link: {
      openOnClick: false,
      autolink: true,
      defaultProtocol: 'https',
      HTMLAttributes: { rel: null, target: null },
    },
  }),
  Note,
]

function Toolbar({ editor }: { editor: Editor }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      style: e.isActive('heading', { level: 2 }) ? 'h2' : e.isActive('heading', { level: 3 }) ? 'h3' : 'p',
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      bullet: e.isActive('bulletList'),
      ordered: e.isActive('orderedList'),
      quote: e.isActive('blockquote'),
      link: e.isActive('link'),
      inNote: e.isActive('note'),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  })

  const setStyle = (value: string) => {
    const chain = editor.chain().focus()
    if (value === 'p') chain.setParagraph().run()
    else chain.setHeading({ level: value === 'h2' ? 2 : 3 }).run()
  }

  const editLink = () => {
    const current = editor.getAttributes('link').href as string | undefined
    const href = window.prompt('Link address (https://… or a page like /booking)', current ?? 'https://')
    if (href === null) return
    const chain = editor.chain().focus().extendMarkRange('link')
    if (href.trim() === '' || href.trim() === 'https://') chain.unsetLink().run()
    else chain.setLink({ href: href.trim() }).run()
  }

  const insertNote = () =>
    editor
      .chain()
      .focus()
      .insertContent({ type: 'note', attrs: { title: DEFAULT_NOTE_TITLE }, content: [{ type: 'paragraph' }] })
      .run()

  const btn = (label: string, active: boolean, onClick: () => void, title: string, disabled = false) => (
    <button
      type="button"
      className="tool"
      aria-pressed={active}
      aria-label={title}
      title={title}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {label}
    </button>
  )

  return (
    <div className="toolbar" role="toolbar" aria-label="Formatting">
      <select className="tool tool--select" value={state.style} onChange={(e) => setStyle(e.target.value)} aria-label="Text style">
        <option value="p">Normal</option>
        <option value="h2">Heading</option>
        <option value="h3">Subheading</option>
      </select>
      <span className="toolbar__sep" />
      {btn('B', state.bold, () => editor.chain().focus().toggleBold().run(), 'Bold')}
      {btn('I', state.italic, () => editor.chain().focus().toggleItalic().run(), 'Italic')}
      {btn('Link', state.link, editLink, 'Add or edit link')}
      <span className="toolbar__sep" />
      {btn('• List', state.bullet, () => editor.chain().focus().toggleBulletList().run(), 'Bullet list')}
      {btn('1. List', state.ordered, () => editor.chain().focus().toggleOrderedList().run(), 'Numbered list')}
      {btn('“ Quote', state.quote, () => editor.chain().focus().toggleBlockquote().run(), 'Quote')}
      {btn('+ Note', false, insertNote, 'Insert highlighted note', state.inNote)}
      <span className="toolbar__spacer" />
      {btn('Undo', false, () => editor.chain().focus().undo().run(), 'Undo', !state.canUndo)}
      {btn('Redo', false, () => editor.chain().focus().redo().run(), 'Redo', !state.canRedo)}
    </div>
  )
}

export default function RichText({
  value,
  onChange,
  docKey,
}: {
  value: JSONContent
  onChange: (value: JSONContent) => void
  /** Changes when a different post is opened, so the editor reloads. */
  docKey: string
}) {
  const editor = useEditor(
    {
      extensions,
      content: value,
      onUpdate: ({ editor: e }) => onChange(e.getJSON()),
      editorProps: { attributes: { class: 'prose', 'aria-label': 'Article' } },
    },
    [docKey],
  )

  if (!editor) return null
  return (
    <div className="richtext">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} className="richtext__surface" />
    </div>
  )
}
