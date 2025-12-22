import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { History, Landmark } from "lucide-react"

interface SymbolSearchProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (symbol: string) => void
}

const SymbolSearch = ({ open, onOpenChange, onSelect }: SymbolSearchProps) => {
  const recentSymbols = ["IBM", "AAPL", "BTC/USD", "TSLA"]
  const popularStocks = [
    { symbol: "MSFT", name: "Microsoft Corp.", exchange: "NASDAQ" },
    { symbol: "GOOGL", name: "Alphabet Inc.", exchange: "NASDAQ" },
    { symbol: "AMZN", name: "Amazon.com Inc.", exchange: "NASDAQ" },
    { symbol: "NVDA", name: "NVIDIA Corp.", exchange: "NASDAQ" },
  ]

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search symbols (e.g. AAPL, BTC)..." />
      <CommandList className="max-h-[400px]">
        <CommandEmpty>No symbols found.</CommandEmpty>
        
        <CommandGroup heading="Recent">
          {recentSymbols.map((s) => (
            <CommandItem
              key={s}
              onSelect={() => {
                onSelect(s)
                onOpenChange(false)
              }}
              className="flex items-center gap-2 cursor-pointer"
            >
              <History className="h-4 w-4 text-slate-500" />
              <span className="font-bold">{s}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Popular Stocks">
          {popularStocks.map((stock) => (
            <CommandItem
              key={stock.symbol}
              onSelect={() => {
                onSelect(stock.symbol)
                onOpenChange(false)
              }}
              className="flex items-center justify-between cursor-pointer py-3"
            >
              <div className="flex items-center gap-3">
                <Landmark className="h-4 w-4 text-slate-500" />
                <div className="flex flex-col">
                  <span className="font-bold">{stock.symbol}</span>
                  <span className="text-xs text-slate-500">{stock.name}</span>
                </div>
              </div>
              <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-medium">
                {stock.exchange}
              </span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}

export default SymbolSearch
