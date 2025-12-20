import React, { useState } from 'react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, LayoutGrid, Bell } from "lucide-react"

interface LayoutProps {
  children: React.ReactNode
  watchlistContent: React.ReactNode
  alertsContent: React.ReactNode
}

const Layout = ({ children, watchlistContent, alertsContent }: LayoutProps) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        setIsSidebarOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="flex h-screen w-full bg-slate-950 text-slate-50 overflow-hidden">
      {/* Main Content Area */}
      <main 
        className="flex-1 relative overflow-hidden" 
        data-testid="main-chart-area"
      >
        {children}
      </main>

      {/* Right Sidebar */}
      <aside 
        data-testid="right-sidebar"
        data-state={isSidebarOpen ? "expanded" : "collapsed"}
        className={`flex border-l border-slate-800 bg-slate-900 transition-all duration-300 ${
          isSidebarOpen ? "w-[350px]" : "w-[56px]"
        }`}
      >
        <Tabs defaultValue="watchlist" className="flex flex-col w-full h-full">
          {/* Sidebar Navigation (Icon Strip) */}
          <div className="flex flex-col items-center py-4 border-r border-slate-800 w-[56px] shrink-0">
            <TabsList className="flex flex-col h-auto bg-transparent gap-4">
              <TabsTrigger 
                value="watchlist" 
                className="p-2 data-[state=active]:bg-slate-800 data-[state=active]:text-blue-400"
                title="Watchlist"
                aria-label="Watchlist"
              >
                <LayoutGrid className="h-5 w-5" />
                <span className="sr-only">Watchlist</span>
              </TabsTrigger>
              <TabsTrigger 
                value="alerts" 
                className="p-2 data-[state=active]:bg-slate-800 data-[state=active]:text-blue-400"
                title="Alerts"
                aria-label="Alerts"
              >
                <Bell className="h-5 w-5" />
                <span className="sr-only">Alerts</span>
              </TabsTrigger>
            </TabsList>
            
            <div className="mt-auto pb-2">
                <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    className="text-slate-400 hover:text-white"
                    data-testid="sidebar-toggle"
                >
                    {isSidebarOpen ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
                </Button>
            </div>
          </div>

          {/* Sidebar Content */}
          {isSidebarOpen && (
            <div className="flex-1 flex flex-col min-w-0">
              <TabsContent value="watchlist" className="flex-1 m-0 p-4 overflow-auto">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-4">Watchlist</h2>
                {watchlistContent}
              </TabsContent>
              <TabsContent value="alerts" className="flex-1 m-0 p-4 overflow-auto">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-4">Alerts</h2>
                {alertsContent}
              </TabsContent>
            </div>
          )}
        </Tabs>
      </aside>
    </div>
  )
}

export default Layout
