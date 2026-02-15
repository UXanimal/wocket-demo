import SearchBar from "./components/SearchBar";

const cards = [
  { icon: "🔍", title: "Look Up Any Building", desc: "Search by address or BIN. See violations, complaints, permits, C of O status, and ownership — all from official DOB and HPD records." },
  { icon: "📄", title: "Generate Court-Ready Reports", desc: "Create detailed building condition reports styled for Housing Court. Filter by date, apartment, and violation type — then print or share." },
  { icon: "🏠", title: "Find a Safe Home", desc: "Check any building before you sign a lease. See violations, complaints, and C of O status so you know what you're walking into." },
  { icon: "⚠️", title: "Track Expired TCOs", desc: "Explore buildings operating on expired Temporary Certificates of Occupancy in violation of NYC law. See how long they've been overdue." },
  { icon: "🎯", title: "Filter by Apartment", desc: "Enter your unit number to highlight violations and complaints specific to your floor and apartment — across every section." },
  { icon: "🤖", title: "Building Summaries", desc: "Get plain-language analysis of a building's condition, flagging patterns that matter — open hazardous violations, permit gaps, and recurring complaints." },
];

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-white dark:bg-[#1a1b2e] border-b border-gray-200 dark:border-gray-700">
        <h1 className="text-2xl md:text-xl font-bold"><span className="font-nunito text-blue-600">Wocket</span> <span className="text-gray-400 dark:text-gray-500 font-normal text-sm">NYC Public Apartment Data</span></h1>
        <a href="#" className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-200">Legal</a>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 text-white py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-6 leading-tight">
            How safe is your building?
          </h2>
          <p className="text-lg text-blue-200 mb-10">Violations, complaints, permits, and ownership records for every building in NYC — from official city data.</p>
          <SearchBar large />
        </div>
      </section>

      {/* Cards */}
      <section className="max-w-5xl mx-auto px-6 py-16 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {cards.map((c) => (
          <div key={c.title} className="bg-white dark:bg-[#1a1b2e] rounded-xl p-6 shadow-sm dark:shadow-none border border-gray-100 dark:border-gray-800 hover:shadow-md transition-shadow">
            <div className="text-2xl mb-3">{c.icon}</div>
            <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">{c.title}</h3>
            <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">{c.desc}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
