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

const IndicatorSearch = ({ open, onOpenChange, onSelect }: IndicatorSearchProps) => {
  const categories = [
    {
      name: "Trend",
      icon: LineChart,
      indicators: [
        { name: "ADXVMA", description: "Adaptive Directional Volatility Moving Average" },
        { name: "Moving Average Exponential", description: "Standard EMA" },
      ],
    },
    {
      name: "Momentum",
      icon: Zap,
      indicators: [
        { name: "TDFI", description: "Trend Direction Force Index" },
        { name: "cRSI", description: "Cyclic Smoothed Relative Strength Index" },
        { name: "Relative Strength Index", description: "Standard RSI" },
      ],
    },
    {
      name: "Volatility",
      icon: Activity,
      indicators: [
        { name: "Bollinger Bands", description: "Standard deviation bands" },
        { name: "Average True Range", description: "Measures market volatility" },
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
                  key={indicator.name}
                  onSelect={() => {
                    onSelect(indicator.name.toLowerCase())
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
