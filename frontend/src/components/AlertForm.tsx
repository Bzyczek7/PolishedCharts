import React, { useState } from 'react'
import { createAlert } from '../api/alerts'

interface AlertFormProps {
  symbolId: number
  onAlertCreated?: () => void
}

const AlertForm = ({ symbolId, onAlertCreated }: AlertFormProps) => {
  const [condition, setCondition] = useState('price_above')
  const [threshold, setThreshold] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setMessage('')

    try {
      await createAlert({
        symbol_id: symbolId,
        condition,
        threshold: condition === 'crsi_band_cross' ? 0 : parseFloat(threshold),
      })
      setMessage('Alert created successfully!')
      setThreshold('')
      if (onAlertCreated) onAlertCreated()
    } catch (error) {
      console.error('Error creating alert:', error)
      setMessage('Failed to create alert.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
      <h3 className="text-xl font-semibold mb-4 text-white">Set Alert</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="condition" className="block text-sm font-medium text-slate-400 mb-1">Condition</label>
          <select 
            id="condition"
            value={condition} 
            onChange={(e) => setCondition(e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="price_above">Price Above</option>
            <option value="price_below">Price Below</option>
            <option value="crsi_band_cross">cRSI Band Cross</option>
          </select>
        </div>
        {condition !== 'crsi_band_cross' && (
            <div>
                <label htmlFor="threshold" className="block text-sm font-medium text-slate-400 mb-1">Threshold Price</label>
                <input 
                    id="threshold"
                    type="number" 
                    step="0.01"
                    value={threshold}
                    onChange={(e) => setThreshold(e.target.value)}
                    required
                    className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. 150.00"
                />
            </div>
        )}
        <button 
          type="submit" 
          disabled={isSubmitting}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white font-bold py-2 px-4 rounded transition duration-200"
        >
          {isSubmitting ? 'Creating...' : 'Create Alert'}
        </button>
        {message && (
          <p className={`text-sm ${message.includes('success') ? 'text-green-400' : 'text-red-400'}`}>
            {message}
          </p>
        )}
      </form>
    </div>
  )
}

export default AlertForm
