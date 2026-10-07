import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";

export function PublicLayout({ children, footer }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">{children}</main>
      {footer === undefined ? <Footer /> : footer}
    </div>
  );
}
