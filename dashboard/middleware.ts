import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const COOKIE_NAME = "aircall_kpi_session";

// Función nativa para generar un hash SHA-256 de la contraseña
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function middleware(request: NextRequest) {
  const sessionCookie = request.cookies.get(COOKIE_NAME);
  const adminPassword = process.env.DASHBOARD_PASSWORD;

  // Si no hay contraseña configurada en las variables de entorno, por seguridad
  // bloqueamos el paso y forzamos redirección a /login para alertar del error.
  if (!adminPassword) {
    console.error("DASHBOARD_PASSWORD no está definida en las variables de entorno.");
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "env_missing");
    return NextResponse.redirect(loginUrl);
  }

  // Generamos el token esperado a partir de la contraseña configurada
  const expectedToken = await hashPassword(adminPassword);

  // Si existe la cookie y coincide con el hash, permitimos el paso
  if (sessionCookie && sessionCookie.value === expectedToken) {
    return NextResponse.next();
  }

  // Si no está autenticado, redirigimos a /login conservando la URL original a la que intentaba acceder
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("callbackUrl", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    /*
     * Intercepta todas las rutas excepto:
     * - api (rutas de API internas, si las hubiera)
     * - _next/static (archivos estáticos de Next.js)
     * - _next/image (optimización de imágenes de Next.js)
     * - favicon.ico y archivos con extensión (imágenes, logos svg, png, etc.)
     * - login (la página de login)
     */
    "/((?!api|_next/static|_next/image|login|favicon.ico|.*\\..*$).*)",
  ],
};
