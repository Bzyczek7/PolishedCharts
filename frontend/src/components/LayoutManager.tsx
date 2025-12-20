import { useState } from 'react'

export interface Layout {
    id: string
    name: string
    activeIndicators: string[] // e.g., ['tdfi', 'crsi', 'adxvma']
    indicatorParams: Record<string, any>
}

interface LayoutManagerProps {
    activeLayout: Layout | null
    onLayoutSelect: (layout: Layout) => void
    onLayoutSave: (name: string) => void
    savedLayouts?: Layout[]
}

const LayoutManager = ({ 
    activeLayout, 
    onLayoutSelect, 
    onLayoutSave,
    savedLayouts = []
}: LayoutManagerProps) => {
    const [newName, setNewName] = useState('')

    return (
        <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
            <h3 className="text-lg font-semibold mb-4 text-white">Layouts</h3>
            
            <div className="space-y-2 mb-6">
                {savedLayouts.map(layout => (
                    <button
                        key={layout.id}
                        onClick={() => onLayoutSelect(layout)}
                        className={`w-full text-left px-3 py-2 rounded transition ${
                            activeLayout?.id === layout.id 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        }`}
                    >
                        {layout.name}
                    </button>
                ))}
                {savedLayouts.length === 0 && (
                    <p className="text-slate-500 text-sm italic">No saved layouts</p>
                )}
            </div>

            <div className="flex gap-2">
                <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Layout name"
                    className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                />
                <button
                    onClick={() => {
                        if (newName.trim()) {
                            onLayoutSave(newName)
                            setNewName('')
                        }
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-medium transition"
                >
                    Save
                </button>
            </div>
        </div>
    )
}

export default LayoutManager
