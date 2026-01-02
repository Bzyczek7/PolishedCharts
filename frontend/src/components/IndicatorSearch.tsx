import React from "react"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { LineChart, Zap, Activity } from "lucide-react"

interface IndicatorSearchProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (indicator: string) => void
}

/**
 * Quick-add indicator search dialog (Cmd+K style)
 * Note: This is a curated list for quick access. For full indicator list,
 * use IndicatorDialog which fetches from the API.
 */
const IndicatorSearch = ({ open, onOpenChange, onSelect }: IndicatorSearchProps) => {
  const categories = [
    {
      name: "Trend",
      icon: LineChart,
      indicators: [
        { id: "adxvma", name: "ADXVMA", description: "Adaptive Directional Volatility Moving Average" },
        { id: "sma", name: "SMA", description: "Simple Moving Average" },
        { id: "ema", name: "EMA", description: "Exponential Moving Average" },
      ],
    },
    {
      name: "Momentum",
      icon: Zap,
      indicators: [
        { id: "tdfi", name: "TDFI", description: "Trend Direction Force Index" },
        { id: "crsi", name: "cRSI", description: "Cyclic Smoothed Relative Strength Index" },
      ],
    },
  ]

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search indicators (e.g. RSI, EMA)..." />
      <CommandList className="max-h-[400px]">
        <CommandEmpty>No indicators found.</CommandEmpty>
        
        {categories.map((category) => (
          <React.Fragment key={category.name}>
            <CommandGroup heading={category.name}>
              {category.indicators.map((indicator) => (
                <CommandItem
                  key={indicator.id}
                  onSelect={() => {
                    onSelect(indicator.id)  // Use stable ID instead of name.toLowerCase()
                    onOpenChange(false)
                  }}
                  className="flex items-center gap-3 cursor-pointer py-3"
                >
                  <category.icon className="h-4 w-4 text-slate-500" />
                  <div className="flex flex-col">
                    <span className="font-bold">{indicator.name}</span>
                    <span className="text-xs text-slate-500">{indicator.description}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </React.Fragment>
        ))}
      </CommandList>
    </CommandDialog>
  )
}

export default IndicatorSearch
