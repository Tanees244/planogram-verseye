'use client'

import Link from 'next/link'
import { FiExternalLink } from 'react-icons/fi'
import { buildEditorUrl } from '@/utils/editorDeepLink'
import { cn } from '@/lib/cn'

export function OpenInEditorLink({
  storeId,
  storeName,
  rackId,
  shelfId,
  className,
  label = 'Open in 3D editor',
  variant = 'primary',
}: {
  storeId: string
  storeName?: string | null
  rackId?: string | null
  shelfId?: string | null
  className?: string
  label?: string
  variant?: 'primary' | 'secondary'
}) {
  const href = buildEditorUrl({ storeId, storeName, rackId, shelfId })
  const canEdit = Boolean(storeId && (rackId || shelfId))

  if (!canEdit) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 text-xs text-gray-400 cursor-not-allowed',
          className,
        )}
        title="Link a rack layout before opening in the editor"
      >
        <FiExternalLink size={14} />
        {label}
      </span>
    )
  }

  return (
    <Link
      href={href}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
        variant === 'primary'
          ? 'bg-[#2C5282] text-white hover:bg-[#1A365D]'
          : 'border border-[#2C5282]/30 text-[#2C5282] hover:bg-[#2C5282]/5',
        className,
      )}
    >
      <FiExternalLink size={14} />
      {label}
    </Link>
  )
}
