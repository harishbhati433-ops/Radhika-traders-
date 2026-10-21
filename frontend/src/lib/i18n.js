import { useCallback, useEffect, useState } from "react";

const KEY = "rt-lang";
export const getLang = () => { try { return localStorage.getItem(KEY) === "hi" ? "hi" : "en"; } catch { return "en"; } };
export const setLang = (l) => { try { localStorage.setItem(KEY, l); } catch {} window.dispatchEvent(new Event("rt:lang")); };

export function useLang() {
  const [lang, set] = useState(getLang());
  useEffect(() => { const f = () => set(getLang()); window.addEventListener("rt:lang", f); return () => window.removeEventListener("rt:lang", f); }, []);
  return lang;
}

export function useT() {
  const lang = useLang();
  return useCallback((s) => (lang === "hi" && HI[s]) || s, [lang]);
}

export const HI = {
  // Navigation
  "Dashboard": "डैशबोर्ड", "Campaigns": "कैंपेन", "My Leads": "मेरी लीड्स", "Wallet": "वॉलेट", "Withdrawals": "पैसे निकालें", "Statements": "स्टेटमेंट",
  "Reports & Files": "रिपोर्ट और फ़ाइलें", "Welcome Letter": "स्वागत पत्र", "Profile & KYC": "प्रोफ़ाइल और KYC", "Signed in as": "लॉगिन:", "Logout": "लॉगआउट",
  "Install App": "ऐप इंस्टॉल करें", "Dark mode": "डार्क मोड", "Light mode": "लाइट मोड",
  // Greetings
  "Good Morning": "शुभ प्रभात", "Good Afternoon": "नमस्ते", "Good Evening": "शुभ संध्या", "Good Night": "शुभ रात्रि",
  // Dashboard
  "Complete your KYC to enable withdrawals.": "पैसे निकालने के लिए अपनी KYC पूरी करें।",
  "Available Balance": "उपलब्ध बैलेंस", "Total Earnings": "कुल कमाई", "Total Withdrawn": "कुल निकासी", "Pending Withdrawal": "पेंडिंग निकासी", "Total Credited": "कुल जमा",
  "Your Referral Code": "आपका रेफरल कोड", "Share campaigns with your code to earn.": "कमाने के लिए अपने कोड से कैंपेन शेयर करें।", "Copy Code": "कोड कॉपी करें", "Referral code copied!": "रेफरल कोड कॉपी हो गया!",
  "Refer & Earn": "रेफर करें और कमाएँ", "Invite friends with your link — poster, QR code & share buttons": "अपने लिंक से दोस्तों को बुलाएँ — पोस्टर, QR कोड और शेयर बटन", "Earn": "कमाएँ",
  "Available Campaigns": "उपलब्ध कैंपेन", "View all": "सभी देखें",
  // Wallet
  "My Wallet": "मेरा वॉलेट", "Main Wallet · Available Balance": "मुख्य वॉलेट · उपलब्ध बैलेंस", "Withdrawable amount": "निकालने योग्य राशि", "Transaction History": "लेन-देन का इतिहास", "No transactions yet.": "अभी कोई लेन-देन नहीं।",
  "Bonus Wallet": "बोनस वॉलेट", "Signup Bonus · Locked": "साइनअप बोनस · लॉक", "Signup Bonus · Fully released": "साइनअप बोनस · पूरा रिलीज़", "Signup Bonus · Credited": "साइनअप बोनस · जमा", "Signup Bonus": "साइनअप बोनस", "Signup Bonus · Not eligible": "साइनअप बोनस · पात्र नहीं",
  "LOCKED": "लॉक",
  "Get leads approved — each one unlocks a Scratch Card that releases this bonus to your Main Wallet.": "लीड्स अप्रूव करवाएँ — हर एक पर स्क्रैच कार्ड मिलेगा जो यह बोनस आपके मुख्य वॉलेट में भेजेगा।",
  "Duplicate account detected — signup bonus is given only once per person.": "डुप्लिकेट खाता पाया गया — साइनअप बोनस एक व्यक्ति को सिर्फ़ एक बार मिलता है।",
  "No signup bonus is running right now.": "अभी कोई साइनअप बोनस नहीं चल रहा।",
  // Withdrawals
  "Request Withdrawal": "निकासी का अनुरोध", "Available:": "उपलब्ध:", "Min": "न्यूनतम", "Withdrawals closed right now": "अभी निकासी बंद है",
  "Amount (₹)": "राशि (₹)", "Payment Method": "भुगतान का तरीका", "UPI ID": "UPI ID", "Bank Account Number": "बैंक खाता संख्या", "Bank Transfer": "बैंक ट्रांसफर",
  "Transaction Password (PIN)": "ट्रांज़ैक्शन पासवर्ड (PIN)", "Submit Request": "अनुरोध भेजें", "Your Requests": "आपके अनुरोध", "No withdrawal requests yet.": "अभी कोई निकासी अनुरोध नहीं।",
  "Payment is transferred manually by Radhika Traders to the UPI ID / bank account above, usually within 24–48 hours. You will see the status here.": "राधिका ट्रेडर्स ऊपर दिए UPI ID / बैंक खाते में भुगतान आमतौर पर 24–48 घंटे में करता है। स्थिति यहाँ दिखेगी।",
  "Your KYC is under review by Radhika Traders. Withdrawals will be enabled once verified.": "आपकी KYC राधिका ट्रेडर्स द्वारा जाँच में है। सत्यापन के बाद निकासी चालू होगी।",
  "Note:": "नोट:", "View payment proof": "भुगतान प्रमाण देखें", "pending": "पेंडिंग", "approved": "स्वीकृत", "paid": "भुगतान हुआ", "rejected": "अस्वीकृत", "duplicate": "डुप्लिकेट",
  // My Leads
  "Total": "कुल", "Pending": "पेंडिंग", "Approved": "स्वीकृत", "Rejected": "अस्वीकृत", "Duplicate": "डुप्लिकेट", "Account Open": "खाता खुला", "Trade Done": "ट्रेड हुआ", "Not Started": "शुरू नहीं", "Account Rejected": "खाता अस्वीकृत",
  "Customers who submitted their details through your referral links. Status is updated by Radhika Traders after verification with the partner.": "वे ग्राहक जिन्होंने आपके रेफरल लिंक से अपनी जानकारी भरी। पार्टनर से सत्यापन के बाद राधिका ट्रेडर्स स्थिति अपडेट करता है।",
  "Search by name, mobile, email or Lead ID": "नाम, मोबाइल, ईमेल या Lead ID से खोजें", "All campaigns": "सभी कैंपेन", "All statuses": "सभी स्थितियाँ",
  "No leads yet. Share your campaign links to get started.": "अभी कोई लीड नहीं। शुरू करने के लिए अपने कैंपेन लिंक शेयर करें।", "No leads match your search.": "आपकी खोज से कोई लीड नहीं मिली।", "Reason:": "कारण:",
  // Statements
  "Statements & Reports": "स्टेटमेंट और रिपोर्ट", "Choose a period, then download your wallet & transaction statement in your preferred format.": "अवधि चुनें, फिर अपना वॉलेट और लेन-देन स्टेटमेंट मनचाहे फ़ॉर्मेट में डाउनलोड करें।",
  "PDF Statement": "PDF स्टेटमेंट", "Formatted wallet statement": "फ़ॉर्मेटेड वॉलेट स्टेटमेंट", "Spreadsheet with all transactions": "सभी लेन-देन की स्प्रेडशीट", "Raw data for any tool": "किसी भी टूल के लिए कच्चा डेटा",
  // Search
  "Campaign name, Lead ID, mobile, ref ID, amount…": "कैंपेन नाम, Lead ID, मोबाइल, ref ID, राशि…", "No results found for": "कोई परिणाम नहीं मिला:", "Try a name, mobile number, ID or amount.": "नाम, मोबाइल नंबर, ID या राशि आज़माएँ।",
  "Recent searches": "हाल की खोजें", "Clear": "साफ़ करें", "Searching only your own records": "सिर्फ़ आपके अपने रिकॉर्ड खोजे जा रहे हैं",
};
