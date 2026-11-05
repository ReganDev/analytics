import type { ReactNode } from 'react'
import Brand from './Brand'

export default function AuthCard({
  title,
  lead,
  children,
}: {
  title: string
  lead?: string
  children: ReactNode
}) {
  return (
    <main className="auth">
      <div className="auth__card">
        <p className="brand">
          <Brand />
        </p>
        <h1 className="auth__title">{title}</h1>
        {lead && <p className="auth__lead">{lead}</p>}
        {children}
      </div>
    </main>
  )
}
