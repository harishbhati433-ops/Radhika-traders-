import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { FestiveStrip } from "../components/FestivalTheme";
import { useFestival } from "../lib/festival";

export function PublicLayout({ children, footer }) {
  const fest = useFestival();
  return (
    <div className="flex min-h-screen flex-col">
      <FestiveStrip fest={fest} />
      <Navbar />
      <main className="flex-1">{children}</main>
      {footer === undefined ? <Footer /> : footer}
    </div>
  );
}
