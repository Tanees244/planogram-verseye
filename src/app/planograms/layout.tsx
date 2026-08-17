/** Catalog pages scroll inside the viewport (3D editor locks scroll on `/` only). */
export default function PlanogramsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="h-dvh overflow-y-auto overflow-x-hidden overscroll-y-contain bg-gray-50">
      {children}
    </div>
  )
}
