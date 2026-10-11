import { TallerCabecera } from "@/components/taller/TallerShell";
import { UniversoTabs } from "@/components/taller/UniversoTabs";

export default function UniversoLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TallerCabecera titulo="Universo" />
      <UniversoTabs />
      {children}
    </>
  );
}
