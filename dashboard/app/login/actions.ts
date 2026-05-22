"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const COOKIE_NAME = "aircall_kpi_session";

// Función para hashear la contraseña
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export interface ActionState {
  success: boolean;
  error?: string;
}

export async function loginAction(
  prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const password = formData.get("password") as string;
  const callbackUrl = (formData.get("callbackUrl") as string) || "/";
  const adminPassword = process.env.DASHBOARD_PASSWORD;

  if (!adminPassword) {
    return {
      success: false,
      error: "Error del servidor: DASHBOARD_PASSWORD no está configurado.",
    };
  }

  if (!password) {
    return {
      success: false,
      error: "Por favor, introduce la contraseña de acceso.",
    };
  }

  if (password !== adminPassword) {
    return {
      success: false,
      error: "Contraseña incorrecta. Por favor, inténtalo de nuevo.",
    };
  }

  // Generamos el hash para guardar como sesión
  const token = await hashPassword(adminPassword);

  // Guardamos la cookie de sesión con los flags de seguridad
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60, // 7 días
    path: "/",
  });

  // Redirección inmediata a la ruta solicitada o la raíz
  redirect(callbackUrl);
}
