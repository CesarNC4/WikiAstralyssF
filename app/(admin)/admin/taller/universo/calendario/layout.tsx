import { CalendarioSubmenu } from "@/components/taller/CalendarioSubmenu";

export default function CalendarioLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CalendarioSubmenu />
      {children}
    </>
  );
}
