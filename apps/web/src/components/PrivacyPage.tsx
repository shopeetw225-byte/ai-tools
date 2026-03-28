import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export function PrivacyPage() {
  const { t } = useTranslation()
  const params = useParams<{ lang: string }>()
  const lang = params.lang ?? 'zh-TW'

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <header className="border-b border-gray-800 px-6 py-3 flex items-center justify-between">
        <Link
          to={`/${lang}/chat`}
          className="text-lg font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent"
        >
          {t('app.name')}
        </Link>
        <Link
          to={`/${lang}/chat`}
          className="text-xs text-gray-400 hover:text-gray-200 transition-colors px-3 py-1.5 rounded-lg border border-gray-700 hover:border-gray-600"
        >
          {t('nav.backToApp')}
        </Link>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-8">
        <article className="prose prose-invert prose-sm max-w-none">
          <h1 className="text-2xl font-bold text-white mb-6">
            貓魚 AI 工具箱 隱私政策
          </h1>

          <p className="text-gray-400 text-sm mb-8">
            <strong>生效日期：2026 年 XX 月 XX 日</strong>（上線時補入實際日期）
          </p>

          <p>
            歡迎使用貓魚 AI 工具箱（以下簡稱「本服務」）。我們非常重視您的隱私，本隱私政策說明我們如何收集、使用、保護您的個人資料，以及您所擁有的權利。
          </p>

          <h2 className="text-xl font-semibold text-white mt-8 mb-4">一、我們是誰</h2>
          <p>
            本服務由<strong>貓魚印象有限公司</strong>（以下簡稱「我們」或「貓魚印象」）營運。如有任何隱私相關問題，請透過本文末尾的聯絡方式與我們聯繫。
          </p>

          <h2 className="text-xl font-semibold text-white mt-8 mb-4">二、我們收集哪些資料</h2>
          <p>使用本服務時，我們可能收集以下個人資料：</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-300 mt-2">
              <thead className="text-xs uppercase text-gray-400 border-b border-gray-700">
                <tr>
                  <th className="px-3 py-2">資料類型</th>
                  <th className="px-3 py-2">具體內容</th>
                  <th className="px-3 py-2">收集目的</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-800">
                  <td className="px-3 py-2">帳號資訊</td>
                  <td className="px-3 py-2">電子郵件地址</td>
                  <td className="px-3 py-2">登入驗證與帳號識別</td>
                </tr>
                <tr className="border-b border-gray-800">
                  <td className="px-3 py-2">使用量資料</td>
                  <td className="px-3 py-2">AI 功能呼叫次數</td>
                  <td className="px-3 py-2">配額管理與計費</td>
                </tr>
                <tr className="border-b border-gray-800">
                  <td className="px-3 py-2">付款記錄</td>
                  <td className="px-3 py-2">訂閱方案、交易時間、付款狀態</td>
                  <td className="px-3 py-2">帳單管理（不含完整信用卡號）</td>
                </tr>
                <tr className="border-b border-gray-800">
                  <td className="px-3 py-2">對話記錄</td>
                  <td className="px-3 py-2">您輸入的 Prompt 及 AI 回覆</td>
                  <td className="px-3 py-2">即時轉送至 AI 模型，不長期儲存</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-2">
            我們<strong>不會</strong>主動收集您的姓名、手機號碼、住址或其他非必要個人資料。
          </p>

          <h2 className="text-xl font-semibold text-white mt-8 mb-4">三、如何使用您的資料</h2>
          <ol className="list-decimal list-inside space-y-1 text-gray-300">
            <li><strong>提供服務</strong>：讓您登入帳號、使用 AI 工具功能</li>
            <li><strong>計費與帳單管理</strong>：核算使用量、處理訂閱付款</li>
            <li><strong>改善產品</strong>：分析使用趨勢、優化服務品質（資料經過去識別化處理）</li>
            <li><strong>法律合規</strong>：依台灣相關法令保存必要交易紀錄</li>
          </ol>
          <p className="mt-2">
            我們<strong>不會</strong>將您的個人資料販售、出租或以其他方式提供給第三方以供其行銷使用。
          </p>

          <h2 className="text-xl font-semibold text-white mt-8 mb-4">四、對話記錄的處理</h2>
          <ul className="list-disc list-inside space-y-1 text-gray-300">
            <li><strong>傳輸方式</strong>：透過 Cloudflare Workers 即時轉送至第三方 AI 模型服務（如 OpenAI、Anthropic）</li>
            <li><strong>儲存期限</strong>：對話記錄<strong>不會長期儲存於我們的資料庫</strong>；請求完成後即不保留</li>
            <li><strong>用途限制</strong>：對話記錄不用於廣告投放、個人特徵分析或任何非服務核心目的</li>
          </ul>
          <p className="mt-4 p-3 bg-gray-900 rounded-lg border border-gray-700 text-gray-400 text-sm">
            <strong>提醒</strong>：建議您避免在對話中輸入敏感個人資料（如身分證字號、銀行密碼等）。
          </p>

          <h2 className="text-xl font-semibold text-white mt-8 mb-4">五、Cookie 與 Session 說明</h2>
          <p>本服務使用 <strong>Cloudflare KV</strong> 儲存登入 Session，以維持您的登入狀態。具體運作方式：</p>
          <ul className="list-disc list-inside space-y-1 text-gray-300 mt-2">
            <li>登入後，系統會在您的瀏覽器中設置一個 Session Cookie</li>
            <li>此 Cookie 僅用於識別您的登入狀態，不含任何個人資料</li>
            <li>登出後，Session Token 即時失效</li>
          </ul>
          <p className="mt-2">我們目前<strong>不使用</strong>廣告追蹤 Cookie 或第三方分析 Cookie。</p>

          <h2 className="text-xl font-semibold text-white mt-8 mb-4">六、資料保護措施</h2>
          <ul className="list-disc list-inside space-y-1 text-gray-300">
            <li><strong>HTTPS 加密</strong>：所有資料傳輸均使用 TLS 加密協定</li>
            <li><strong>Cloudflare 基礎設施</strong>：服務架設於 Cloudflare 全球網路，具備 DDoS 防護、WAF 防火牆與高可用性</li>
            <li><strong>密碼安全</strong>：帳號密碼採 bcrypt 雜湊儲存，我們無法取得您的明文密碼</li>
            <li><strong>付款安全</strong>：付款流程由 <strong>ECPay（綠界科技）</strong>處理，我們不儲存您的信用卡資料</li>
          </ul>

          <h2 className="text-xl font-semibold text-white mt-8 mb-4">七、您的個人資料權利</h2>
          <p>依據台灣《個人資料保護法》第 3 條，您對您的個人資料享有以下權利：</p>
          <ul className="list-disc list-inside space-y-1 text-gray-300 mt-2">
            <li><strong>查閱權</strong>：請求查看我們所持有的您的個人資料</li>
            <li><strong>更正權</strong>：要求更正不正確或不完整的資料</li>
            <li><strong>刪除權</strong>：要求刪除您的帳號及相關個人資料</li>
            <li><strong>停止蒐集、處理或利用</strong>：要求我們停止對您個人資料的相關操作</li>
          </ul>
          <p className="mt-2">
            如需行使上述權利，請寄信至：<strong>[需填入隱私聯絡信箱]</strong>
          </p>
          <p>我們將於收到請求後 <strong>30 日內</strong>回覆。</p>

          <h2 className="text-xl font-semibold text-white mt-8 mb-4">八、第三方服務</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-300 mt-2">
              <thead className="text-xs uppercase text-gray-400 border-b border-gray-700">
                <tr>
                  <th className="px-3 py-2">服務商</th>
                  <th className="px-3 py-2">用途</th>
                  <th className="px-3 py-2">隱私政策</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-800">
                  <td className="px-3 py-2">ECPay（綠界科技）</td>
                  <td className="px-3 py-2">付款處理</td>
                  <td className="px-3 py-2">
                    <a href="https://www.ecpay.com.tw/Service/Privacy" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">查看</a>
                  </td>
                </tr>
                <tr className="border-b border-gray-800">
                  <td className="px-3 py-2">Cloudflare</td>
                  <td className="px-3 py-2">基礎設施與網路安全</td>
                  <td className="px-3 py-2">
                    <a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">查看</a>
                  </td>
                </tr>
                <tr className="border-b border-gray-800">
                  <td className="px-3 py-2">OpenAI / Anthropic</td>
                  <td className="px-3 py-2">AI 模型服務</td>
                  <td className="px-3 py-2 text-gray-500">各自官網</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2 className="text-xl font-semibold text-white mt-8 mb-4">九、未成年人保護</h2>
          <p>
            本服務<strong>不適用於 13 歲以下的未成年人</strong>。如果我們得知在未獲得可驗證之父母同意的情況下收集了未成年人的個人資料，我們將立即刪除相關資料。
          </p>

          <h2 className="text-xl font-semibold text-white mt-8 mb-4">十、隱私政策的變更</h2>
          <p>
            我們保留隨時修訂本隱私政策的權利。發生重大變更時，我們將透過以下方式通知您：
          </p>
          <ul className="list-disc list-inside space-y-1 text-gray-300 mt-2">
            <li>向您的註冊電子郵件發送通知</li>
            <li>在本頁面顯著位置公告，並更新生效日期</li>
          </ul>

          <h2 className="text-xl font-semibold text-white mt-8 mb-4">十一、聯絡我們</h2>
          <p>如您對本隱私政策有任何疑問或需要行使您的個人資料權利，請聯絡：</p>
          <ul className="list-disc list-inside space-y-1 text-gray-300 mt-2">
            <li><strong>電子郵件</strong>：[需填入隱私聯絡信箱]</li>
            <li><strong>公司名稱</strong>：貓魚印象有限公司</li>
          </ul>

          <p className="text-gray-500 text-xs mt-8 border-t border-gray-800 pt-4">
            本文件最後更新於 2026 年 3 月 29 日
          </p>
        </article>
      </main>

      <footer className="border-t border-gray-800 px-6 py-4 text-center">
        <p className="text-xs text-gray-500">
          &copy; 2026 貓魚印象有限公司 &middot;{' '}
          <Link to={`/${lang}/privacy`} className="text-gray-400 hover:text-gray-200 transition-colors">
            隱私政策
          </Link>
        </p>
      </footer>
    </div>
  )
}
