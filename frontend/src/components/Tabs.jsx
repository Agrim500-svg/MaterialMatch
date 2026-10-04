export default function Tabs({ tabs, active, onChange }) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-full border border-[--color-line] bg-white p-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className="tab-pill"
          data-active={active === tab.id}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
