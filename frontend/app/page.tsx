import SearchBar from "./components/SearchBar";

const cards = [
  { title: "Tenants", desc: "Know your rights. Check your building's violation history, ownership records, and safety scores before signing — or while living there." },
  { title: "Apartment Hunters", desc: "Don't just tour the apartment — investigate the building. See open violations, expired certificates, and landlord track records." },
  { title: "Professionals", desc: "Attorneys, organizers, and journalists: search by owner, cross-reference portfolios, and export data for your work." },
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
            Get the facts about the apartment or building you live in, or are thinking about renting
          </h2>
          <p className="text-lg text-blue-200 mb-10">Search NYC building records, violations, and ownership data</p>
          <SearchBar large />
        </div>
      </section>

      {/* Cards */}
      <section className="max-w-5xl mx-auto px-6 py-16 grid md:grid-cols-3 gap-6">
        {cards.map((c) => (
          <div key={c.title} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <h3 className="text-lg font-semibold mb-2 text-gray-900">{c.title}</h3>
            <p className="text-gray-600 text-sm leading-relaxed">{c.desc}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
