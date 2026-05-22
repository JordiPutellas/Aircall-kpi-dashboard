import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import LoginForm from "./LoginForm";

export const metadata = {
  title: "Iniciar Sesión | Aircall KPIs",
  description: "Inicia sesión en el Dashboard analítico en tiempo real de Aircall KPIs.",
};

const COOKIE_NAME = "aircall_kpi_session";

// Función nativa para generar el hash SHA-256 de la contraseña
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function LoginPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const callbackUrl = typeof params.callbackUrl === "string" ? params.callbackUrl : "/";
  const errorParam = params.error;

  const adminPassword = process.env.DASHBOARD_PASSWORD;
  let envError = false;

  if (!adminPassword) {
    envError = true;
  } else {
    // Si la contraseña existe y ya tenemos una cookie de sesión válida,
    // redirigimos directamente al dashboard sin mostrar el login
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(COOKIE_NAME);
    const expectedToken = await hashPassword(adminPassword);

    if (sessionCookie && sessionCookie.value === expectedToken) {
      redirect("/");
    }
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-[90vh] md:min-h-screen px-4 py-12 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-250">
      <LoginForm 
        callbackUrl={callbackUrl} 
        envError={envError || errorParam === "env_missing"} 
      />
    </div>
  );
}
