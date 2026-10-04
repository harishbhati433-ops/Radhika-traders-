export const PARTNER_TERMS_VERSION = "2026-10";

export const PARTNER_TERMS = [
  ["INDEPENDENT PARTNER STATUS", ["मैं confirm करता/करती हूँ कि मैं एक Independent Freelance Adviser/Referral Partner हूँ और यह Referral ID मेरी freelance referral activities के लिए issue की गई है।", "मैं Radhika Traders का employee नहीं हूँ और बिना Radhika Traders की written authorization के खुद को Radhika Traders का employee, agent या authorized representative के रूप में represent नहीं करूँगा/करूँगी।"]],
  ["CUSTOMER CONSENT & ACCURATE INFORMATION", ["मैं किसी भी customer को किसी financial product, offer, approval, returns, benefits, charges या eligibility के संबंध में गलत, misleading या unauthorized information/promise नहीं दूँगा/दूँगी।", "मैं customer की clear consent के बाद ही application initiate या assist करूँगा/करूँगी।"]],
  ["NO MISREPRESENTATION", ["मैं खुद को गलत तरीके से Radhika Traders, किसी Bank, NBFC, Broker, AMC, Insurer या किसी अन्य Financial Institution का employee या authorized representative नहीं बताऊँगा/बताऊँगी।"]],
  ["USE OF APPROVED CAMPAIGN MATERIAL", ["मैं केवल Radhika Traders द्वारा दिए या authorized किए गए approved campaign links, creatives, communication और terms का उपयोग करूँगा/करूँगी।", "मैं किसी campaign material को misleading तरीके से modify नहीं करूँगा/करूँगी।"]],
  ["PAYOUT / CAMPAIGN TERMS", ["Campaign Payouts, KPIs, Eligibility Criteria, Validation Rules, Campaign Availability और अन्य commercial terms को Radhika Traders future transactions के लिए update, revise, pause या discontinue कर सकता है, applicable terms और law के अनुसार।", "किसी भी eligible reward की calculation संबंधित activity/date पर लागू Payout और Campaign Terms के अनुसार होगी।"]],
  ["VALIDATION OF REWARDS", ["Pending Rewards तभी payable होंगे जब संबंधित client/platform की report द्वारा activity confirm और validate हो जाए तथा applicable Validation/Reversal Period पूरा हो जाए।"]],
  ["FRAUD / INVALID ACTIVITY", ["Fraudulent, Fake, Duplicate, Manipulated, Unauthorized, Cancelled, Reversed, Self-generated या किसी अन्य प्रकार की invalid activity को reject किया जा सकता है।", "ऐसी activity के against यदि कोई incentive पहले ही credit या paid हो चुका है, तो उसे Wallet Adjustment, Future Payout Adjustment या applicable law के अनुसार अन्य legally permissible तरीके से reverse/recover किया जा सकता है।"]],
  ["CUSTOMER DATA & PRIVACY", ["मैं customer की information को confidential रखूँगा/रखूँगी और Personal, Financial, KYC या अन्य Customer Data का उपयोग केवल authorized campaign/application purpose के लिए करूँगा/करूँगी।", "मैं customer information को बिना proper authorization के misuse, sell, share या disclose नहीं करूँगा/करूँगी।"]],
  ["OTP & KYC", ["मैं customer के OTP, Password, KYC Documents, Bank Details या किसी अन्य authentication information का misuse नहीं करूँगा/करूँगी।", "जहाँ required होगा, customer को authentication और consent process खुद complete करना होगा।"]],
  ["LEGAL & POLICY COMPLIANCE", ["मैं सभी applicable Indian Laws, Regulations, Campaign-specific Conditions, Privacy Requirements और Radhika Traders की applicable policies का पालन करने के लिए सहमत हूँ।"]],
  ["TAXES & STATUTORY OBLIGATIONS", ["मैं समझता/समझती हूँ कि अपनी Referral/Freelance Activities से संबंधित applicable Tax, GST, TDS और अन्य statutory obligations की responsibility applicable law के अनुसार मेरी हो सकती है।"]],
  ["SUSPENSION / TERMINATION", ["Fraud, Policy Violation, Misuse, Compliance Concerns या अन्य valid business reasons के कारण Radhika Traders मेरे Partner/Referral Access को suspend, restrict या terminate कर सकता है, applicable law और contractual terms के अनुसार।"]],
  ["CHANGES TO TERMS", ["Radhika Traders समय-समय पर इन Partner Terms को update कर सकता है।", "जब updated terms partner platform या अन्य appropriate communication के माध्यम से available करा दिए जाएँगे, तब future activities के लिए latest applicable version लागू होगा।"]],
  ["ACCEPTANCE", ["Register करने, Referral ID का उपयोग करने, Campaigns access करने, Leads generate करने या Acceptance Checkbox submit करने पर मैं confirm करता/करती हूँ कि मैंने इन Partner Declaration & Terms को पढ़ा, समझा और स्वीकार किया है।"]],
  ["KYC & WITHDRAWAL", ["आपका Partner Account Full KYC complete किए बिना भी approve किया जा सकता है।", "हालाँकि, किसी भी Payment/Withdrawal को release केवल तब किया जाएगा जब आपका Full KYC complete और approved हो जाएगा।"]],
];

export function PartnerTermsBody({ compact }) {
  return (
    <div className={`space-y-3 ${compact ? "text-[12px] leading-relaxed" : "text-sm leading-relaxed"} text-slate-700`} data-testid="partner-terms-body">
      {PARTNER_TERMS.map(([h, ps], i) => (
        <section key={h}>
          <h4 className={`font-bold text-slate-900 ${compact ? "text-[12px]" : "text-sm"}`}>{i + 1}. {h}</h4>
          {ps.map((p, j) => <p key={j} className="mt-0.5">{p}</p>)}
        </section>
      ))}
    </div>
  );
}
