# 🖥️ Aircall KPIs Dashboard - Frontend (Next.js)

Este es el módulo de visualización y analíticas del proyecto **Aircall KPIs Dashboard**. Está construido sobre **Next.js 16** (App Router), **React 19**, **TailwindCSS** y **Recharts**, y se conecta de forma segura a **Neon Postgres** mediante consultas y acciones del lado del servidor.

Para ver la arquitectura del sistema completo, configuración de la base de datos y despliegue del worker de ingesta, consulta el [README principal del proyecto](../README.md).

---

## 🚀 Inicio Rápido

1. Entra al directorio e instala las dependencias:
   ```bash
   cd dashboard
   npm install
   ```

2. Configura las variables de entorno creando un archivo `.env.local` en esta carpeta:
   ```env
   DATABASE_URL="tu_neon_database_connection_string"
   DASHBOARD_PASSWORD="tu_contraseña_de_acceso"
   ```

3. Lanza el servidor de desarrollo:
   ```bash
   npm run dev
   ```
   Abre [http://localhost:3000](http://localhost:3000) en tu navegador para ver la aplicación.

---

## 🛠️ Tecnologías Utilizadas

* **Framework**: Next.js 16 (App Router) + React 19.
* **Lenguaje**: TypeScript para tipado estricto de queries y payloads.
* **Estilos**: TailwindCSS con soporte nativo para Modo Oscuro/Claro interactivo.
* **Iconografía**: Lucide React.
* **Base de Datos**: Driver serverless de Neon (`@neondatabase/serverless`) con pooling de conexiones.
* **Seguridad**: Middleware de Next.js para control de acceso criptográfico mediante cookies de sesión.

---

## 📂 Estructura del Módulo

* **`/app`**: Páginas de la aplicación (Login, Overview Diario, Detalle de Pausas, Timeline y Wallboard).
* **`/components`**: Componentes de cliente interactivos y maquetación general (Sidebar, ThemeToggle, etc.).
* **`/lib`**: Módulo de conexión a base de datos Postgres (`db.ts`).
* **`/public`**: Activos estáticos y recursos multimedia del frontend.

---

## 📦 Producción y Despliegue

Para compilar la aplicación optimizada para producción:
```bash
npm run build
```

Para ejecutar el servidor de producción compilado localmente:
```bash
npm run start
```
