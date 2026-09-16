import { DashboardLayout } from "../../components/DashboardLayout";
import { adminNav } from "./nav";
import { ContactSettings } from "../../components/ContactSettings";

export default function AdminContact() {
  return (
    <DashboardLayout nav={adminNav} title="Contact & Support Settings">
      <ContactSettings />
    </DashboardLayout>
  );
}
