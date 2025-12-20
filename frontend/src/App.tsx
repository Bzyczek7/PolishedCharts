import './App.css'
import ChartComponent from './components/ChartComponent'

function App() {
  return (
    <div className="min-h-screen bg-slate-900 text-white p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">TradingAlert</h1>
        <p className="text-slate-400">Your personalized trading dashboard</p>
      </header>
      <main>
        <div className="bg-slate-800 rounded-lg p-6 h-[500px] border border-slate-700">
          <ChartComponent symbol="IBM" />
        </div>
      </main>
    </div>
  )
}

export default App