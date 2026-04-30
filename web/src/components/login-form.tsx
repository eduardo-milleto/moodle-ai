"use client";

import { ArrowRight, BookOpenCheck, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password })
    });

    setIsSubmitting(false);

    if (!response.ok) {
      setError("Senha inválida.");
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <main className="login-shell">
      <div className="site-backdrop" aria-hidden="true">
        <video src="/moodle-cover.mp4" autoPlay muted loop playsInline />
        <div className="site-backdrop-shade" />
      </div>

      <header className="cover-header">
        <div className="brand-cluster">
          <div className="brand-mark">
            <BookOpenCheck size={21} />
          </div>
          <div>
            <p className="eyebrow">Moodle AI</p>
            <strong>Tarefas Unisinos</strong>
          </div>
        </div>
        <div className="cover-header-meta">
          <span>
            <ShieldCheck size={15} />
            Acesso privado
          </span>
        </div>
      </header>

      <section className="login-grid" aria-labelledby="login-title">
        <div className="cover-copy">
          <span className="cover-kicker">
            <Sparkles size={15} />
            Sync automático com Moodle
          </span>
          <h1 id="login-title">Uma central elegante para não perder nenhuma entrega.</h1>
          <p>
            O painel consolida prazos, urgência e histórico de sincronização em uma experiência
            rápida, protegida e feita para consulta diária.
          </p>
          <div className="cover-stats" aria-label="Recursos">
            <span>ICS fallback</span>
            <span>Playwright worker</span>
            <span>Postgres</span>
          </div>
        </div>

        <div className="login-panel">
          <div className="login-panel-header">
            <div className="brand-mark lock" aria-hidden="true">
              <LockKeyhole size={21} />
            </div>
            <div>
              <p className="eyebrow">Dashboard</p>
              <h2>Acessar painel</h2>
            </div>
          </div>
        <form className="login-form" onSubmit={handleSubmit}>
          <label htmlFor="password">Senha</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          {error ? <p className="form-error">{error}</p> : null}
          <button type="submit" disabled={isSubmitting}>
            <span>{isSubmitting ? "Entrando" : "Entrar"}</span>
            <ArrowRight size={18} />
          </button>
        </form>
        </div>
      </section>
    </main>
  );
}
