# MikroTik PPP Manager

Production-oriented web administration console for managing MikroTik RouterOS PPP secrets (`/ppp/secret`), PPP profiles (`/ppp/profile`), and active subscriber tunnels (`/ppp/active`) over the native RouterOS binary API / API-SSL protocol (Port `8729` TLS) without WinBox.

---

## 1. Architecture Overview

- **Frontend (`/src`)**:
  - React 19 + TypeScript + Vite + Tailwind CSS v4
  - TanStack Query (`@tanstack/react-query`) & TanStack Table (`@tanstack/react-table`)
  - React Hook Form + Zod input validation
  - Recharts real-time subscriber connection telemetry
  - Bilingual Localization: **English (LTR)** with `Plus Jakarta Sans` + `JetBrains Mono` (`tabular-nums`) and **Persian / فارسی (RTL)** with `Vazirmatn`
  - Dual Theme: **Dark Mode** and **Light Mode**
  - Global Command Palette (`⌘K` / `Ctrl+K`)

- **Backend Implementations**:
  1. **ASP.NET Core Web API (`.NET 10`) (`/backend/MikroTikPppManager.Api`)**:
     - Clean, modular C# architecture (`Controllers`, `Services`, `Infrastructure/MikroTikRouterOsClient.cs`, `Models/Dtos.cs`, `Program.cs`)
     - Native asynchronous `TcpClient` + `SslStream` binary RouterOS protocol implementation supporting TLS 1.2/1.3 certificate validation, RouterOS v6.43+ cleartext/TLS login, and legacy MD5 challenge-response fallback.
     - Swagger / OpenAPI, sliding-window rate limiting, and zero-plaintext audit logging.
  2. **Integrated Live & Demo Gateway (`/server.ts`, `/server/mikrotikClient.ts`, `/server/pppService.ts`)**:
     - Runs natively on port `3000` in container environments without the .NET 10 SDK installed, implementing the exact same REST endpoints and binary RouterOS TCP/TLS protocol over Node's `net` and `tls` modules.

> **Verification Transparency Note**: The React/TypeScript frontend and the Node.js/TypeScript binary RouterOS API backend (`server.ts` + `server/mikrotikClient.ts`) are compiled, linted, and verified directly in this runtime environment. Because the live sandbox container does not have the `dotnet` (.NET 10) CLI installed, the complete ASP.NET Core (.NET 10) source files in `/backend/MikroTikPppManager.Api/` are provided for `.NET 10` / Docker deployments and are clearly distinguished from the live Node runtime.

---

## 2. RouterOS Least-Privilege Setup

Never connect using the full `admin` account in production. On your MikroTik router, create a dedicated least-privilege group and enable `api-ssl` on port `8729`:

```routeros
/user group add name=ppp-api-group policy=api,read,write,sensitive,!ftp,!reboot,!policy,!test,!sniff,!romon
/user add name=ppp-api-admin group=ppp-api-group password="STRONG_RANDOM_PASSWORD" comment="MikroTik PPP Manager API account"
/ip service set api-ssl port=8729 certificate=router-tls-cert disabled=no
/ip service disable api
```

---

## 3. RouterOS Asymmetric Rate-Limit Semantics

In RouterOS `/ppp/profile`, the `rate-limit` attribute follows the format:

```text
rx-rate[/tx-rate] [rx-burst-rate[/tx-burst-rate] [rx-burst-threshold[/tx-burst-threshold] [rx-burst-time[/tx-burst-time] [priority] [rx-rate-min[/tx-rate-min]]]]]
```

From the **RouterOS PPP Server interface perspective**:
- `rx-rate` = traffic received by the router from the subscriber = **Client Upload**
- `tx-rate` = traffic transmitted by the router to the subscriber = **Client Download**

For example, a **50 Mbps Download / 20 Mbps Upload** profile is serialized as `20M/50M`. The built-in Bandwidth Editor in **PPP Profiles** handles this mapping automatically.

---

## 4. Development & Production Deployment

### Local Development (Integrated Full-Stack Server)

```bash
cp .env.example .env
npm install
npm run dev
```

Open `http://localhost:3000`.

### Running the ASP.NET Core (.NET 10) Backend

```bash
cd backend/MikroTikPppManager.Api
dotnet restore
dotnet run
```

Swagger UI is available at `http://localhost:8080/swagger` in Development mode.

### Docker Compose Deployment

```bash
cp .env.example .env
docker compose up --build -d
```
