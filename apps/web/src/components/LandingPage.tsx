export function LandingPage({ onEnter }: { onEnter: () => void }) {
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-3 flex items-center justify-between">
        <span className="text-lg font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
          AI Tools
        </span>
        <button
          onClick={onEnter}
          className="text-sm text-gray-400 hover:text-gray-200 transition-colors px-4 py-1.5 rounded-lg border border-gray-700 hover:border-gray-600"
        >
          登入
        </button>
      </header>

      {/* Hero Section */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 py-20 min-h-[60vh]">
        <h1 className="text-4xl md:text-5xl font-bold text-white text-center leading-tight">
          用 AI 讀懂世界，工作快十倍
        </h1>
        <p className="mt-4 text-lg text-gray-400 max-w-xl text-center">
          專為台灣用戶打造的 AI 工具箱——摘要、翻譯、程式碼解釋，一站搞定
        </p>
        <div className="mt-8 flex gap-4">
          <button
            onClick={onEnter}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors"
          >
            免費開始使用
          </button>
          <a
            href="#pricing"
            className="px-6 py-3 border border-gray-600 hover:border-gray-400 text-gray-300 hover:text-white font-medium rounded-lg transition-colors"
          >
            查看定價
          </a>
        </div>
      </section>

      {/* Features Section */}
      <section className="px-6 py-16 max-w-5xl mx-auto w-full">
        <h2 className="text-2xl font-bold text-center mb-10">三大核心工具</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FeatureCard
            icon="✦"
            title="智慧摘要"
            description="貼入任何長文，瞬間濃縮成結構化重點。省下 80% 閱讀時間。"
          />
          <FeatureCard
            icon="↔"
            title="多語翻譯"
            description="支援繁中、簡中、英語等多語言即時對譯。精準流暢，無需切換工具。"
          />
          <FeatureCard
            icon="⟨/⟩"
            title="程式碼解釋"
            description="看不懂別人的程式碼？貼上去，AI 逐段說明邏輯，新手也能看懂。"
          />
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="px-6 py-16 max-w-4xl mx-auto w-full">
        <h2 className="text-2xl font-bold text-center">簡單定價，沒有隱藏費用</h2>
        <p className="mt-2 text-gray-400 text-center">先免費試用，滿意再升級</p>
        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
          <PricingCard
            plan="免費方案"
            price="NT$0"
            period="/月"
            features={[
              '每天 10 次 AI 請求',
              '摘要、翻譯、程式碼解釋',
              '基本串流回應',
            ]}
            cta="免費開始使用"
            onCta={onEnter}
          />
          <PricingCard
            plan="Pro 方案"
            price="NT$99"
            period="/月"
            features={[
              '無限 AI 請求',
              '優先回應速度',
              '進階模型選擇',
              '歷史對話記錄',
            ]}
            cta="立即升級"
            onCta={onEnter}
            highlighted
          />
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-950 border-t border-gray-800 px-6 py-8">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-500">
          <span>&copy; 2024 貓魚印象有限公司</span>
          <a href="mailto:contact@maoyu.ai" className="hover:text-gray-300 transition-colors">
            contact@maoyu.ai
          </a>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
      <div className="text-2xl mb-3">{icon}</div>
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm text-gray-400">{description}</p>
    </div>
  )
}

function PricingCard({
  plan,
  price,
  period,
  features,
  cta,
  onCta,
  highlighted,
}: {
  plan: string
  price: string
  period: string
  features: string[]
  cta: string
  onCta: () => void
  highlighted?: boolean
}) {
  return (
    <div
      className={`rounded-xl p-6 border flex flex-col ${
        highlighted
          ? 'bg-gray-900 border-blue-600'
          : 'bg-gray-900 border-gray-800'
      }`}
    >
      <h3 className="text-lg font-semibold text-white">{plan}</h3>
      <div className="mt-3">
        <span className="text-3xl font-bold text-white">{price}</span>
        <span className="text-gray-400 text-sm">{period}</span>
      </div>
      <ul className="mt-6 flex-1 space-y-3">
        {features.map((f) => (
          <li key={f} className="text-sm text-gray-300 flex items-start gap-2">
            <span className="text-blue-400 mt-0.5">✓</span>
            {f}
          </li>
        ))}
      </ul>
      <button
        onClick={onCta}
        className={`mt-6 w-full py-2.5 rounded-lg font-medium transition-colors ${
          highlighted
            ? 'bg-blue-600 hover:bg-blue-500 text-white'
            : 'border border-gray-600 hover:border-gray-400 text-gray-300 hover:text-white'
        }`}
      >
        {cta}
      </button>
    </div>
  )
}
