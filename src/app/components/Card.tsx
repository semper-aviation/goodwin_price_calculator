import React from "react"

type CardProps = {
  title: string
  children: React.ReactNode
}

export default function Card({ title, children }: CardProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur">
      <div className="text-base font-semibold text-slate-800 mb-4">{title}</div>
      {children}
    </div>
  )
}
