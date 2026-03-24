import { useState } from "react";
import { Lock } from "lucide-react";

interface LoginScreenProps {
  onLogin: () => void;
}

const PASSWORD = "valentum-demo-passwort";

const LoginScreen = ({ onLogin }: LoginScreenProps) => {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === PASSWORD) {
      onLogin();
    } else {
      setError(true);
      setTimeout(() => setError(false), 2000);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-background px-4">
      <div className="w-full max-w-sm text-center space-y-8">
        <div className="space-y-5">
          <div className="bg-white rounded-xl p-4 inline-block shadow-sm border border-border">
            <img
              src="https://www.valentum.de/static/layout/valentum/site/valentum_engineering_logo.png"
              alt="Valentum Engineering"
              className="h-14"
            />
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Exposé Generator
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Passwort eingeben"
              className="w-full h-11 pl-10 pr-4 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              autoFocus
            />
          </div>
          {error && (
            <p className="text-destructive text-sm">Falsches Passwort.</p>
          )}
          <button
            type="submit"
            className="w-full h-11 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Anmelden
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginScreen;
