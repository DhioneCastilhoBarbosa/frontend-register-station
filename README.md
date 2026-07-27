# Cadastro de Carregador

Formulário web moderno e mobile-first para registrar estações de recarga na plataforma **Intelbras CVE**, consumindo a API `cve-registration-api`.

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-8-646CFF?style=flat-square&logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-4-38BDF8?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind" />
  <img src="https://img.shields.io/badge/Leaflet-Map-199900?style=flat-square&logo=openstreetmap&logoColor=white" alt="Leaflet" />
</p>

---

## O que faz

Interface única para o time operacional cadastrar carregadores **públicos** ou **privados**, com:

| Recurso | Detalhe |
| --- | --- |
| Autenticação silenciosa | Login automático via `.env` — sem tela de login |
| CEP automático | Com 8 dígitos preenche rua, cidade, UF e abre o mapa |
| Mapa interativo | Pin arrastável + visão **Mapa** / **Satélite** |
| Serial por câmera | Leitura de código de barras / QR no celular |
| Estação privada | Busca por CPF (proprietário + múltiplos acessos) |
| RFID opcional | Lista de tags no mesmo cadastro |
| Horário | 24h ou janela específica (`HH:MM`) |
| Licença embutida | `VITE_LICENSE_CODE` — sem campo na UI |
| Feedback | Toasts de sucesso / erro genérico |

---

## Stack

- **React 19** + **TypeScript**
- **Vite 8**
- **Tailwind CSS 4**
- **Leaflet** (OpenStreetMap + Esri Imagery)
- **html5-qrcode** (scanner)
- **React Router**
- Fonte **Inter**

---

## Fluxos principais

```text
Boot → POST /auth/login (credenciais do .env)
     → Bearer JWT nas rotas protegidas

Público  → formulário → POST /registrations (visibility=public)

Privado  → CPF proprietário → GET /users/by-cpf/{cpf}
         → CPFs de acesso permitido (1..N)
         → POST /registrations (authorized_users)
```

**authorized_users (privado)**

| Papel | Payload |
| --- | --- |
| Proprietário | `{ user_pk, owner: true, bind_exists: false, bind_status: "NOT_REQUESTED" }` |
| Acesso permitido | `{ user_pk, owner: false, bind_exists: false, bind_status: "ACCEPTED" }` |

---

## Início rápido

```bash
# 1. Instalar
npm install

# 2. Configurar ambiente
cp .env.example .env
# edite VITE_API_URL, VITE_AUTH_EMAIL, VITE_AUTH_PASSWORD, VITE_LICENSE_CODE

# 3. Rodar
npm run dev
```

Abra [http://localhost:5173](http://localhost:5173).

> Após alterar o `.env`, reinicie o Vite.

---

## Variáveis de ambiente

| Variável | Descrição |
| --- | --- |
| `VITE_API_URL` | Base da API (ex.: `https://api-register.api-castilho.com.br`) |
| `VITE_AUTH_EMAIL` | Usuário do painel (login automático) |
| `VITE_AUTH_PASSWORD` | Senha do painel |
| `VITE_LICENSE_CODE` | Licença enviada em todos os cadastros (`P3D-` / `12M-` / `36M-`…) |

**Arquivos**

| Arquivo | Uso | Versionado? |
| --- | --- | --- |
| `.env` | Desenvolvimento local | Não |
| `.env.production` | URL da API no build | Sim |
| `.env.production.local` | Credenciais no build local | Não |
| `.env.example` | Modelo | Sim |

API de produção atual:

```text
https://api-register.api-castilho.com.br
```

---

## Scripts

```bash
npm run dev       # desenvolvimento
npm run build     # build de produção → dist/
npm run preview   # preview do dist/
npm run lint      # oxlint
```

---

## Docker

```bash
docker build \
  --build-arg VITE_AUTH_EMAIL=seu@email.com \
  --build-arg VITE_AUTH_PASSWORD=sua-senha \
  --build-arg VITE_LICENSE_CODE=P3D-xxxx \
  -t cadastro-carregador-frontend .

docker run --rm -p 8080:80 cadastro-carregador-frontend
```

A imagem serve o SPA via **Nginx**. A API precisa liberar **CORS** para o domínio do frontend.

---

## Estrutura

```text
src/
├── api/              # HTTP (auth, registrations, CEP/geocode)
├── components/       # UI, mapa, scanner, CPF, toasts
├── context/          # AuthProvider (login silencioso)
├── lib/              # máscaras, modelos, helpers
├── pages/            # formulário de cadastro
└── types/            # contratos TypeScript
```

---

## Modelos de carregador

- EVE 0074C City  
- EVE 0110C City  
- EVE 0074B Business  
- EVE 0220B Business  

---

## Segurança

As variáveis `VITE_*` são **embutidas no JavaScript** no build. Qualquer pessoa pode inspecionar o bundle e ver e-mail/senha do painel.

Recomendações:

- Use um usuário **exclusivo** deste formulário, com permissão mínima  
- Não reutilize credenciais administrativas  
- Garanta HTTPS + CORS correto na API  

---

## Requisitos da API

Contrato esperado (`cve-registration-api`):

| Método | Rota | Uso |
| --- | --- | --- |
| `POST` | `/auth/login` | Token JWT |
| `GET` | `/users/by-cpf/{cpf}` | Usuário CVE (privado) |
| `POST` | `/registrations` | Cadastro do carregador |

Header nas rotas protegidas: `Authorization: Bearer <token>`

---

<p align="center">
  <sub>Cadastro de Carregador · Frontend · Intelbras CVE</sub>
</p>
