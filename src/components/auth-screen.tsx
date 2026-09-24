"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, KeyRound, ShieldCheck } from "lucide-react";
import { api, message } from "@/lib/client";
import { Brand, Notice } from "./ui";
export function AuthScreen({
  master = false,
  initialRegister = false,
}: {
  master?: boolean;
  initialRegister?: boolean;
}) {
  const router = useRouter();
  const [register, setRegister] = useState(initialRegister && !master);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");
    const values = new FormData(event.currentTarget);
    try {
      const credentials = {
        email: String(values.get("email")),
        password: String(values.get("password")),
      };
      if (register) {
        const result = await api("auth/register", "POST", {
          ...credentials,
          name: String(values.get("name")),
        });
        setSuccess(result.message);
        setRegister(false);
      } else {
        const user = await api("auth/login", "POST", {
          ...credentials,
          master,
        });
        router.push(
          user.mustChangePassword
            ? "/change-password"
            : user.status !== "APPROVED"
              ? "/pending"
              : user.role === "MASTER"
                ? "/master-admin"
                : "/dashboard",
        );
        router.refresh();
      }
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-page">
      <section className="auth-side">
        <Link href="/" className="brand-link">
          <Brand />
        </Link>
        <div className="auth-box">
          <span className="eyebrow">
            {master ? "ACESSO RESTRITO" : "MENOS RUÍDO. MAIS RESPOSTAS."}
          </span>
          <h1>
            {master
              ? "Nos bastidores."
              : register
                ? "Seu próximo começo."
                : "Boas perguntas.\nNovas descobertas."}
          </h1>
          <p className="muted">
            {master
              ? "Entre com sua conta de administrador master."
              : register
                ? "Crie sua conta para começar. O acesso segue a política de aprovação do site."
                : "Entre no seu espaço para criar, compartilhar e ouvir."}
          </p>
          <form onSubmit={submit} className="stack">
            {register && (
              <label>
                Seu nick (aparece nos seus formulários)
                <input
                  name="name"
                  autoComplete="name"
                  required
                  minLength={2}
                  maxLength={100}
                  placeholder="Como podemos chamar você?"
                />
              </label>
            )}
            <label>
              E-mail
              <input
                type="email"
                name="email"
                required
                autoComplete="email"
                maxLength={254}
                placeholder="voce@exemplo.com"
              />
            </label>
            <label>
              Senha
              <input
                type="password"
                name="password"
                required
                minLength={12}
                maxLength={128}
                autoComplete={register ? "new-password" : "current-password"}
                placeholder="Pelo menos 12 caracteres"
              />
            </label>
            <Notice text={error} />
            <Notice text={success} success />
            <button className="button primary full" disabled={busy}>
              {busy
                ? "Aguarde…"
                : register
                  ? "Solicitar minha conta"
                  : "Entrar no meu espaço"}
              <ArrowRight size={18} />
            </button>
          </form>
          {!master && (
            <p className="auth-switch">
              {register ? "Já tem uma conta?" : "Ainda não tem uma conta?"}{" "}
              <button
                className="text-button"
                onClick={() => {
                  setRegister(!register);
                  setError("");
                  setSuccess("");
                }}
              >
                {register ? "Entrar" : "Criar conta"}
              </button>
            </p>
          )}
          {master && (
            <Link className="text-button" href="/">
              Voltar ao login
            </Link>
          )}
        </div>
        <footer className="auth-footer">
          <span>© {new Date().getFullYear()} GhostForms</span>
          <Link
            className="master-entry"
            href={master ? "/" : "/master-admin"}
            aria-label={
              master ? "Login de criador" : "Acesso do administrador master"
            }
          >
            <KeyRound size={14} />
          </Link>
        </footer>
      </section>
      <aside className="auth-art">
        <div className="art-top">
          <span>GF — O OUTRO LADO DA PERGUNTA</span>
          <img className="art-mini-logo" src="/brand/ghost.png" alt="" />
        </div>
        <div className="art-content">
          <img
            className="art-ghost"
            src="/brand/ghost.png"
            alt="Fantasma geométrico GhostForms"
          />
          <h2>
            Dê forma
            <br />
            ao desconhecido<span>.</span>
          </h2>
          <p>
            Cada resposta revela
            <br />
            uma nova possibilidade.
          </p>
        </div>
        <div className="art-bottom">
          <ShieldCheck size={17} />
          <span>Seu espaço. Seus formulários.</span>
          <span>01 / GF</span>
        </div>
      </aside>
    </main>
  );
}
