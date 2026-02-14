import SearchBar from "./components/SearchBar";

const cards = [
  { icon: "🔍", title: "Look Up Any Building", desc: "Search by address or BIN. See violations, complaints, permits, C of O status, and ownership — all from official DOB and HPD records." },
  { icon: "📄", title: "Generate Court-Ready Reports", desc: "Create detailed building condition reports styled for Housing Court. Filter by date, apartment, and violation type — then print or share." },
  { icon: "⚠️", title: "Track Expired TCOs", desc: "Explore buildings operating on expired Temporary Certificates of Occupancy in violation of NYC law. See how long they've been overdue." },
  { icon: "🏢", title: "Research Ownership", desc: "View HPD registration records, owner and agent contacts, and litigation history. Know who's responsible for your building." },
  { icon: "🎯", title: "Filter by Apartment", desc: "Enter your unit number to highlight violations and complaints specific to your floor and apartment — across every section." },
  { icon: "🤖", title: "AI Building Summaries", desc: "Get plain-language analysis of a building's condition, flagging patterns that matter — open hazardous violations, permit gaps, and recurring complaints." },
];

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
        <h1 className="text-xl font-bold"><span className="font-nunito text-blue-600">Wocket</span> <span className="text-gray-400 font-normal text-sm">NYC Public Apartment Data</span></h1>
        <a href="#" className="text-sm text-gray-500 hover:text-gray-700">Legal</a>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 text-white py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-6 leading-tight">
            Know your building.<br />Before you sign — or while you live there.
          </h2>
          <p className="text-lg text-blue-200 mb-10">Violations, permits, ownership, and C of O status for every building in NYC — from official city records.</p>
          <SearchBar large />
        </div>
      </section>

      {/* Cards */}
      <section className="max-w-5xl mx-auto px-6 py-16 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {cards.map((c) => (
          <div key={c.title} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="text-2xl mb-3">{c.icon}</div>
            <h3 className="text-lg font-semibold mb-2 text-gray-900">{c.title}</h3>
            <p className="text-gray-600 text-sm leading-relaxed">{c.desc}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
