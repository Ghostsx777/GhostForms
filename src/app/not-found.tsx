import { Ghost } from "lucide-react";
export default function NotFound() {
  return (
    <main className="status-page">
      <Ghost size={52} />
      <h1>Nada por aqui.</h1>
      <p className="muted">Este endereço não existe ou não está disponível.</p>
    </main>
  );
}
