import { Icon } from "@/components/Icon";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border-glow bg-deep p-8">
        <div className="mb-6 flex items-center gap-2">
          <Icon name="Star" className="text-accent" size={22} />
          <span className="font-display text-2xl text-gradient-cosmic">Astralys</span>
        </div>
        <h1 className="mb-1 font-display text-xl text-fg">Panel del autor</h1>
        <p className="mb-6 text-sm text-fg-muted">Acceso exclusivo del administrador.</p>
        <LoginForm />
      </div>
    </div>
  );
}
