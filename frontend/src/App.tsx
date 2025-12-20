import './App.css'

function App() {
  return (
    <div className="min-h-screen bg-slate-900 text-white p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">TradingAlert</h1>
        <p className="text-slate-400">Your personalized trading dashboard</p>
      </header>
      <main>
        <div className="bg-slate-800 rounded-lg p-6 h-[500px] flex items-center justify-center border border-slate-700">
          <p className="text-slate-500">Chart will be initialized here</p>
        </div>
      </main>
    </div>
  )
}

export default App