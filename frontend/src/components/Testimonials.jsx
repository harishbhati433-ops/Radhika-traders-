import { useEffect, useRef, useState } from "react";
import { Star, Quote, ChevronLeft, ChevronRight, BadgeCheck } from "lucide-react";

const REVIEWS = [
  { name: "Shareen Bano", role: "MBA Student · Indore", stars: 5, text: "Radhika Traders ke saath kaam karna bahut flexible hai. College ke baad jab time milta hai tab link share karti hoon aur leads approve hote hi wallet mein paise aa jaate hain. Zero investment, sirf mehnat." },
  { name: "Rahul Verma", role: "Insurance Agent · Ujjain", stars: 5, text: "Main pehle se clients se milta hoon, ab unko Demat account bhi khulwa deta hoon. Payout time pe aata hai aur Harish ji ki team WhatsApp pe turant reply karti hai. Best side income." },
  { name: "Priya Sharma", role: "Homemaker · Agar Malwa", stars: 5, text: "Ghar baithe ₹8,000–₹12,000 mahine ka extra kama leti hoon. Referral link share karna bilkul aasaan hai aur dashboard mein sab kuch saaf dikhta hai — kitne leads, kitna approved, kitna paisa." },
  { name: "Aman Patel", role: "B.Com Student · Bhopal", stars: 4, text: "Sabse achhi baat transparency hai. Har lead ka status dikhta hai aur statement PDF download ho jaata hai. Pehli withdrawal 2 din mein bank mein aa gayi thi." },
  { name: "Mohammed Faizan", role: "Mobile Shop Owner · Ratlam", stars: 5, text: "Dukaan pe roz 20–30 customers aate hain, unhe campaign ka QR poster dikha deta hoon. Bina koi paisa lagaye har mahine achha payout mil raha hai. Genuine platform." },
  { name: "Neha Jain", role: "Freelancer · Dewas", stars: 5, text: "I have worked with 3 affiliate networks before — Radhika Traders is the most honest one. No hidden conditions, clear payout per campaign, and real people to talk to when I have a question." },
  { name: "Vikram Singh Rathore", role: "Ex-Bank Employee · Shajapur", stars: 5, text: "Banking background hone ki wajah se main KYC aur account opening jaldi karwa deta hoon. Yahan ka duplicate-check system fair hai — jo pehle lead laata hai usko credit milta hai." },
  { name: "Kavita Yadav", role: "Teacher · Mandsaur", stars: 4, text: "School ke baad 1 ghanta deti hoon. Referral bonus + campaign payout dono milte hain. Dark mode aur mobile app install karne ka option bhi bahut sahi hai — sab phone se ho jaata hai." },
  { name: "Deepak Kushwah", role: "Delivery Partner · Indore", stars: 5, text: "Delivery ke saath-saath customers ko Demat offer bata deta hoon. Pehle mahine hi ₹6,500 kamaye. Withdrawal request karte hi status update milta hai. Bilkul bharosemand." },
  { name: "Sneha Agrawal", role: "CA Aspirant · Ujjain", stars: 5, text: "Campaign details, requirements aur payout sab ek jagah likha hota hai, isliye customer ko samjhana easy hai. Team professional hai aur payments time pe hoti hain." },
  { name: "Ravi Malviya", role: "Kirana Store · Agar Malwa", stars: 5, text: "Harish bhai ko personally jaanta hoon, isliye bharosa tha — aur platform ne bharosa nibhaya. Har hafte payout, koi jhanjhat nahi. Gaon ke logon ke liye kamai ka sahi rasta." },
  { name: "Anjali Mishra", role: "Nursing Student · Bhopal", stars: 4, text: "Hostel se hi kaam karti hoon. Signup bonus pehle lead approve hone par mila tha, aur uske baad har lead ka paisa wallet mein dikhta hai. Simple aur clear process." },
];

const Stars = ({ n }) => (
  <div className="flex gap-0.5" aria-label={`${n} out of 5 stars`}>
    {[1, 2, 3, 4, 5].map((i) => <Star key={i} className={`h-4 w-4 ${i <= n ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} />)}
  </div>
);

const initials = (name) => name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
const PALETTE = ["bg-red-100 text-red-700", "bg-amber-100 text-amber-700", "bg-emerald-100 text-emerald-700", "bg-sky-100 text-sky-700", "bg-violet-100 text-violet-700", "bg-rose-100 text-rose-700"];

function useVisible() {
  const [n, setN] = useState(() => (typeof window === "undefined" ? 3 : window.innerWidth < 640 ? 1 : window.innerWidth < 1024 ? 2 : 3));
  useEffect(() => {
    const f = () => setN(window.innerWidth < 640 ? 1 : window.innerWidth < 1024 ? 2 : 3);
    window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, []);
  return n;
}

export function Testimonials({ interval = 3000 }) {
  const per = useVisible();
  const pages = Math.ceil(REVIEWS.length / per);
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const timer = useRef(null);

  useEffect(() => { setIdx((i) => Math.min(i, pages - 1)); }, [pages]);
  useEffect(() => {
    if (paused) return;
    timer.current = setInterval(() => setIdx((i) => (i + 1) % pages), interval);
    return () => clearInterval(timer.current);
  }, [paused, pages, interval]);

  const go = (i) => setIdx(((i % pages) + pages) % pages);

  return (
    <section className="bg-slate-50 py-16" data-testid="testimonials-section" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onTouchStart={() => setPaused(true)} onTouchEnd={() => setPaused(false)}>
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-white px-3 py-1 text-xs font-bold uppercase tracking-wider text-red-600"><BadgeCheck className="h-3.5 w-3.5" /> Verified Feedback</span>
            <h2 className="mt-3 font-display text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Loved by our <span className="text-red-600">Partners</span></h2>
            <p className="mt-2 max-w-xl text-sm text-slate-600">Real stories from students, shopkeepers, homemakers and agents earning with Radhika Traders — with zero investment.</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => go(idx - 1)} aria-label="Previous reviews" data-testid="testimonials-prev" className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-red-600 hover:text-white"><ChevronLeft className="h-5 w-5" /></button>
            <button type="button" onClick={() => go(idx + 1)} aria-label="Next reviews" data-testid="testimonials-next" className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-red-600 hover:text-white"><ChevronRight className="h-5 w-5" /></button>
          </div>
        </div>

        <div className="overflow-hidden" data-testid="testimonials-track">
          <div className="flex transition-transform duration-700 ease-[cubic-bezier(.22,.61,.36,1)]" style={{ transform: `translateX(-${idx * 100}%)` }}>
            {Array.from({ length: pages }).map((_, p) => (
              <div key={p} className="grid w-full shrink-0 gap-5 px-1" style={{ gridTemplateColumns: `repeat(${per}, minmax(0, 1fr))` }} data-testid={`testimonials-page-${p}`} aria-hidden={p !== idx}>
                {REVIEWS.slice(p * per, p * per + per).map((r, i) => (
                  <article key={r.name} className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md" data-testid={`testimonial-${p * per + i}`}>
                    <div className="flex items-center justify-between"><Stars n={r.stars} /><Quote className="h-6 w-6 text-red-100" /></div>
                    <p className="mt-4 flex-1 text-sm leading-relaxed text-slate-700">“{r.text}”</p>
                    <div className="mt-5 flex items-center gap-3 border-t border-slate-100 pt-4">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${PALETTE[(p * per + i) % PALETTE.length]}`}>{initials(r.name)}</div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-bold text-slate-900">{r.name}</div>
                        <div className="truncate text-xs text-slate-500">{r.role}</div>
                      </div>
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700"><BadgeCheck className="h-3 w-3" /> Verified</span>
                    </div>
                  </article>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 flex items-center justify-center gap-2" data-testid="testimonials-dots">
          {Array.from({ length: pages }).map((_, p) => (
            <button key={p} type="button" onClick={() => go(p)} aria-label={`Go to reviews page ${p + 1}`} data-testid={`testimonials-dot-${p}`}
              className={`h-2 rounded-full transition-[width,background-color] duration-300 ${p === idx ? "w-6 bg-red-600" : "w-2 bg-slate-300 hover:bg-slate-400"}`} />
          ))}
        </div>
      </div>
    </section>
  );
}
