# 🌡️ Get Temp — ColdChain IoT Dashboard

> **Plataforma de Monitoramento Térmico em Tempo Real para Câmaras Frigoríficas**  
> Projeto acadêmico / protótipo IoT full-stack com suporte a ESP32 via MQTT.

[![Deploy Status](https://img.shields.io/badge/vercel-live-brightgreen?logo=vercel)](https://gettempappts.vercel.app)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8.x-purple?logo=vite)](https://vitejs.dev/)

---

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Stack Tecnológica](#stack-tecnológica)
3. [Estrutura do Projeto](#estrutura-do-projeto)
4. [Status das Telas](#status-das-telas)
5. [Funcionalidades Implementadas](#funcionalidades-implementadas)
6. [🚧 Roadmap — Funcionalidades Pendentes](#roadmap--funcionalidades-pendentes)
7. [🧪 Checklist de Testes Pré-Lançamento](#checklist-de-testes-pré-lançamento)
8. [Integração MQTT (Guia Futuro)](#integração-mqtt-guia-futuro)
9. [Como Executar Localmente](#como-executar-localmente)
10. [Deploy](#deploy)
11. [Contribuição](#contribuição)

---

## Visão Geral

**Get Temp** é um dashboard web progressivo voltado ao monitoramento térmico de câmaras frigoríficas industriais. A aplicação foi concebida para se comunicar com dispositivos **ESP32** via protocolo **MQTT**, coletando leituras de temperatura, status de conexão, uso de memória e uptime em intervalos configuráveis.

Atualmente o projeto opera em modo **mock** (dados simulados via JSON estático), com toda a arquitetura de dados abstraída em um `DataService` preparado para receber conexão MQTT real com uma única alteração de configuração.

---

## Stack Tecnológica

| Camada | Tecnologia |
|---|---|
| Build Tool | [Vite 8](https://vitejs.dev/) |
| Linguagem | TypeScript 5.x |
| Estilização | Tailwind CSS (via CDN) + tokens Material Design 3 |
| Tipografia | Google Fonts — Space Grotesk + Manrope |
| Ícones | Material Symbols Outlined |
| Dados (mock) | JSON estático em `/public/mock/esp32_mock.json` |
| Dados (tempo real) | MQTT via `mqtt` npm package |
| Hosting | [Vercel](https://vercel.com) (via `vercel.json` + `vite.config.ts`) |
| Repositório | [GitHub](https://github.com/cleberfeitosa-id/get-temp-app) |

---

## Estrutura do Projeto

```
gettemp_app_ts/
├── public/
│   └── mock/
│       └── esp32_mock.json        ← Dados simulados do ESP32
├── src/
│   ├── main.ts                    ← Lógica principal / roteamento por página
│   ├── dataService.ts            ← Abstração de dados (Mock + MQTT real-time)
│   ├── mqttService.ts            ← Serviço de conexão MQTT
│   └── style.css                 ← Estilos globais
├── index.html                    ← Dashboard de Status (tempo real)
├── analise.html                  ← Análise Temporal com Filtros (tempo real)
├── relatorios.html               ← Geração e Export de Relatórios
├── detalhes_camara.html          ← Detalhe por Câmara (tempo real)
├── ajustes.html                 ← Configurações, Perfil e Gestão de Câmaras
├── historico_alertas.html        ← Feed de Alertas
├── nova_camara.html              ← Formulário de Cadastro/Edição de Câmara
├── visualizacao_relatorio.html   ← Preview de Relatório Gerado
├── login.html                    ← Tela de Login
├── vite.config.ts                ← Configuração MPA do Vite
└── vercel.json                  ← Roteamento limpo na Vercel
```

---

## Status das Telas

| Tela | URL | Status | Dados Dinâmicos |
|---|---|---|---|
| Dashboard | `/` | ✅ Funcional | ✅ Câmaras do mock |
| Análise | `/analise` | ✅ Funcional | ✅ Filtros & PDF |
| Relatórios | `/relatorios` | ✅ Funcional | ✅ CSV/JSON/PDF |
| Detalhes Câmara | `/detalhes_camara?id=CAM01` | ✅ Funcional | ✅ Gráfico + Logs |
| Ajustes | `/ajustes` | ✅ Funcional | ✅ Câmaras, Perfil, Notificações |
| Histórico Alertas | `/historico_alertas` | ✅ Funcional | ✅ Feed dinâmico |
| Nova Câmara | `/nova_camara` | ✅ Funcional | ✅ CRUD de câmaras |
| Visualização Relatório | `/visualizacao_relatorio` | ✅ Funcional | ✅ Dados reais + Empresa |
| Login | `/login` | ✅ Funcional | ✅ Autenticação mock |

---

## Funcionalidades Implementadas

### ✅ Dashboard (`index.html`)
- Temperatura ao vivo e nome da câmara principal (CAM01) via mock
- Cards dinâmicos para cada câmara identificada no mock
- Badge de status (Seguro / Aviso / Offline) calculado dinamicamente
- Barra de progresso por câmara
- Navegação para `/detalhes_camara?id=<device_id>`
- Bottom NavBar e Top AppBar injetados via `main.ts`
- Avatar do perfil com iniciais dinâmicas no header

### ✅ Análise (`analise.html`)
- Dropdown de seleção de câmara populado dinamicamente com IDs do mock
- Filtros temporais (24h / 7d / 30d) com cálculo real sobre timestamps
- Estatísticas (Máx, Mín, Média) recalculadas a cada filtro
- Gráfico SVG dinâmico responsivo aos dados filtrados
- Log de Alertas populado dos dados (apenas quando `temp >= -15` ou `Disconnected`)
- **Botão "Baixar PDF"**: gera janela limpa com apenas o log de alertas e invoca `window.print()`

### ✅ Relatórios (`relatorios.html`)
- Data Inicial e Data Final preenchidas automaticamente com bounds reais do mock
- Seleção de tipo de relatório com estado visual (Resumo Semanal / Auditoria / Histórico)
- Checkboxes de customização (Incluir Gráficos / Incluir Logs) com estado rastreado
- Seletor de formato (PDF / CSV / JSON) com estado visual ativo
- **Botão "Gerar Relatório"**:
  - PDF: documento HTML montado dinamicamente com título e blocos condicionais
  - CSV: arquivo tabulado com campos do mock
  - JSON: payload completo com metadados de configuração
- "Relatórios Recentes" injetados dinamicamente com datas e tamanhos estimados do mock

### ✅ Detalhes Câmara (`detalhes_camara.html`)
- Filtra dados do mock pelo `?id=` na URL (`CAM01` ou `CAM02`)
- Temperatura atual do último registro exibida no header
- Gráfico SVG de linha calculado sobre todos os registros da câmara
- Logs Recentes com timestamp, status e temperatura reais (em ordem reversa)

### ✅ Login (`login.html`)
- Autenticação mock com email `admin@gettemp.io` e senha `gettemp123`
- Token armazenado em localStorage
- Proteção de rotas (páginas bloqueadas sem autenticação)
- Redirecionamento pós-login para dashboard

### ✅ Ajustes (`ajustes.html`)
- **Gestão de Câmaras**: lista dinâmica de câmaras registradas
- **Criar Câmara**: botão "Nova Câmara" abre formulário multipassos
- **Editar Câmara**: menu de contexto (⋮) com opção de edição
- **Remover Câmara**: exclusão com animação e atualização do localStorage
- **Editar Perfil**: modal com campos de Nome, Email, Cargo, Empresa, Localização e CNPJ
- **Dados da Empresa**: salvos em localStorage e exibidos nos relatórios
- **Preferências de Notificação**: toggles com persistência em localStorage
- **Avatar do Perfil**: iniciais dinâmicas no header, clicável para ajustes
- **Logout**: botão "Sair" remove token e redireciona para login

### ✅ Nova Câmara (`nova_camara.html`)
- Formulário multipassos (3 etapas): Identificação → Rede → Confirmação
- **Validação de campos obrigatórios**: Nome, Localização, IP, ID do dispositivo
- **Sliders de temperatura**: Min/Max com feedback visual em tempo real
- **Modo de Edição**: pré-popula formulário com dados existentes via `?edit=<device_id>`
- **Persistência**: dados salvos em localStorage (key: `gettemp_cameras`)
- **Feedback visual**: mensagem de sucesso personalizada para criação/edição

### ✅ Visualização de Relatório (`visualizacao_relatorio.html`)
- Dados dinâmicos populados do mock com filtros por câmara
- Estatísticas (Máx, Mín, Média) calculadas em tempo real
- Gráfico de barras com indicador de temperatura média
- **Informações da Empresa**: exibidas no relatório (nome, localização, CNPJ)
- Exporto via `window.print()` para PDF

### ✅ Histórico de Alertas (`historico_alertas.html`)
- Feed dinâmico filtrado por alertas (temp >= -15 ou Disconnected)
- Busca por texto
- Filtros por categoria (Todos / Temperatura / Offline)

---

## 🚧 Roadmap — Funcionalidades Pendentes

### 🔴 Crítico (Bloqueia Lançamento)

#### Autenticação Real
- [ ] Substituir autenticação mock por Firebase Auth, Supabase ou JWT
- [ ] Implementar logout completo com invalidação de token
- [ ] Adicionar recuperação de senha

#### Backend e Persistência
- [ ] Substituir localStorage por API REST ou GraphQL
- [ ] Migrar dados mock para banco de dados (PostgreSQL/MongoDB)
- [ ] Implementar sync em tempo real entre dispositivos

#### Integração MQTT
- [ ] Configurar broker MQTT (HiveMQ, EMQX, ou similar)
- [ ] Implementar subscriber no frontend
- [ ] Validar formato de mensagens ESP32

### 🟠 Alta Prioridade

#### UX/UI
- [ ] Tela de onboarding para primeiro acesso
- [ ] Tutorial interativo de uso do dashboard
- [ ] Modo offline com dados em cache

#### Relatórios
- [ ] Agendamento de relatórios recorrentes (daily/weekly)
- [ ] Envio de relatórios por email automaticamente
- [ ] Templates de relatório customizáveis

#### Notificações
- [ ] Notificações push via Service Worker
- [ ] Integração com SMS (Twilio)
- [ ] Webhooks para integração com sistemas externos

### 🟡 Médio Prazo

#### Analytics
- [ ] Gráfico consolidado "Todas as Câmaras"
- [ ] Previsão de manutenção preditiva
- [ ] Dashboard executivo com KPIs

#### Segurança
- [ ] Autenticação em dois fatores (2FA)
- [ ] Logs de auditoria
- [ ] Criptografia de dados sensíveis

---

## 🧪 Checklist de Testes Pré-Lançamento

> Execute estes testes manualmente em [https://gettempappts.vercel.app](https://gettempappts.vercel.app) antes de qualquer release público.

### 🧭 Navegação e Routing

- [ ] Acesso direto pela URL `/analise` exibe a página de análise (não 404)
- [ ] Acesso direto pela URL `/relatorios` exibe a página de relatórios (não 404)
- [ ] Acesso direto pela URL `/detalhes_camara?id=CAM01` exibe dados da câmara 1
- [ ] Acesso direto pela URL `/detalhes_camara?id=CAM02` exibe dados da câmara 2
- [ ] Bottom NavBar em todas as telas navega corretamente entre Status / Análise / Relatórios / Ajustes
- [ ] Seta de voltar no header retorna à tela anterior corretamente
- [ ] Item ativo do NavBar fica destacado na tela atual
- [ ] Avatar do perfil no header navega para `/ajustes`

### 📊 Dashboard (`/`)

- [ ] Temperatura principal exibida corresponde ao mock (`CAM01`, registro mais recente)
- [ ] Cards das duas câmaras (CAM01 e CAM02) são exibidos corretamente
- [ ] Temperatura de cada card corresponde ao último registro do mock para aquela câmara
- [ ] Badge de status ("Seguro" / "Aviso" / "Offline") reflete o estado do mock
- [ ] Clique no card navega para `/detalhes_camara?id=CAM01` ou `CAM02`

### 📈 Análise (`/analise`)

- [ ] Dropdown exibe "CAM01" e "CAM02" populados do mock
- [ ] Selecionar CAM01 atualiza stats, gráfico e logs
- [ ] Selecionar CAM02 atualiza stats, gráfico e logs
- [ ] Botão "24h" filtra registros corretamente
- [ ] Botão "7d" filtra registros corretamente
- [ ] Botão "30d" filtra registros corretamente
- [ ] Botão ativo do filtro fica visualmente destacado
- [ ] Log de Alertas exibe apenas registros com `temp >= -15` ou `Disconnected`
- [ ] **Botão "Baixar PDF"** abre janela limpa com log de alertas e dispara `window.print()`

### 📄 Relatórios (`/relatorios`)

- [ ] "Data Inicial" exibe a data mais antiga do mock (ex: 2026-03-10)
- [ ] "Data Final" exibe a data mais recente do mock (ex: 2026-03-20)
- [ ] Clicar em "Resumo Semanal" destaca o card visualmente
- [ ] Clicar em "Auditoria de Qualidade" destaca o card visualmente
- [ ] Clicar em "Histórico de Alertas" destaca o card visualmente
- [ ] Selecionar formato "CSV" destaca o botão CSV
- [ ] Selecionar formato "JSON" destaca o botão JSON
- [ ] Selecionar formato "PDF" destaca o botão PDF
- [ ] **"Gerar Relatório" → PDF**: abre janela de impressão com título correto
- [ ] **"Gerar Relatório" → CSV**: baixa arquivo `.csv` com dados do mock
- [ ] **"Gerar Relatório" → JSON**: baixa arquivo `.json` com dados do mock e configuração
- [ ] PDF com "Incluir Gráficos" marcado exibe seção de gráfico no documento
- [ ] PDF com "Incluir Logs" marcado exibe lista de registros no documento
- [ ] "Relatórios Recentes" exibe 3 entradas com datas coerentes com o mock

### 🔍 Detalhes de Câmara (`/detalhes_camara?id=CAM01`)

- [ ] Temperatura do header exibe o valor mais recente da CAM01
- [ ] Gráfico SVG traça uma curva com base nos múltiplos registros da CAM01
- [ ] Log exibe todos os registros da CAM01 em ordem cronológica reversa
- [ ] Acessar com `?id=CAM02` exibe dados da CAM02

### ⚙️ Ajustes (`/ajustes`)

- [ ] Lista de câmaras é exibida dinamicamente
- [ ] Câmaras do localStorage aparecem na lista
- [ ] Câmaras do mock aparecem na lista
- [ ] Toggle de "Alertas de Temperatura Crítica" exibe toast quando alterado
- [ ] Toggle de "Resumos Diários" exibe toast quando alterado
- [ ] Estado dos toggles persiste após reload da página
- [ ] Botão "Editar Perfil" abre modal com campos preenchidos
- [ ] Salvar perfil atualiza nome no header e dados da empresa nos relatórios
- [ ] Botão "Sair" redireciona para `/login`
- [ ] Botão "Nova Câmara" redireciona para `/nova_camara`
- [ ] Menu de contexto (⋮) aparece ao clicar
- [ ] Opção "Editar câmara" navega para `/nova_camara?edit=<id>`
- [ ] Opção "Remover câmara" exclui a câmara com animação

### 📱 Responsividade e Acessibilidade

- [ ] Todas as telas são funcionais em mobile (375px)
- [ ] Todas as telas são funcionais em tablet (768px)
- [ ] Todas as telas são funcionais em desktop (1280px)
- [ ] Fonte e contraste visível em todas as telas
- [ ] Sem scroll horizontal indesejado

### ⚡ Performance

- [ ] Página inicial carrega em menos de 3 segundos na conexão 4G simulada
- [ ] Mock JSON responde dentro de 500ms na Vercel
- [ ] Trocar câmara no dropdown de análise atualiza em menos de 200ms
- [ ] Geração de CSV/JSON para 15 registros é instantânea

---

## Integração MQTT (Implementado)

O sistema agora suporta dados em tempo real via MQTT. Configure o broker na variável `MQTT_BROKER_URL` em `src/main.ts`:

```typescript
// No início do arquivo src/main.ts
const MQTT_BROKER_URL = 'wss://seu-broker:8084/mqtt';
```

### Broker MQTT Compatíveis

- **HiveMQ Cloud** (gratuito para testes): `wss://broker.hivemq.com:8884/mqtt`
- **Mosquitto** com WebSocket habilitado
- **AWS IoT Core**
- Qualquer broker MQTT com suporte a WebSockets

### Tópico e Formato da Mensagem

O ESP32 deve publicar no tópico: `gettemp/<device_id>`

```json
{
  "device_id": "CAM01",
  "name": "Câmara Principal A-14",
  "temp": -18.4,
  "wifi_rssi": -65,
  "connection": "Connected",
  "date": "2026-03-20",
  "time": "12:00:00"
}
```

### Campos Opcionais

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `device_id` | string | ID único da câmara (obrigatório) |
| `name` | string | Nome da câmara |
| `temp` | number | Temperatura em °C (obrigatório) |
| `wifi_rssi` | number | Sinal Wi-Fi em dBm |
| `spiffs_usage` | number | Uso da memória SPIFFS (%) |
| `free_heap` | number | Memória livre do ESP32 |
| `uptime` | number | Tempo de operação em segundos |
| `device_ip` | string | Endereço IP do dispositivo |
| `connection` | string | Status: "Connected" ou "Disconnected" |

### Status da Conexão MQTT

Um indicador no header mostra o status da conexão:
- **MQTT** (verde): Conectado ao ESP32
- **DEMO** (cinza): Modo demo com dados simulados

```json
{
  "name": "Câmara 01",
  "device_id": "CAM01",
  "device_ip": "192.168.1.101",
  "temp": -18.5,
  "wifi_rssi": -55,
  "date": "2026-03-23",
  "time": "14:30:00",
  "connection": "Connected"
}
```

---

## Como Executar Localmente

```bash
# Clone o repositório
git clone https://github.com/cleberfeitosa-id/get-temp-app.git
cd get-temp-app/gettemp_app_ts

# Instale dependências
npm install

# Inicie o servidor de desenvolvimento
npm run dev
# → Acesse http://localhost:5173

# Build para produção
npm run build
```

---

## Deploy

Este projeto é automaticamente configurado para a Vercel.

```bash
# Deploy manual via CLI
npx vercel --prod --token=SEU_TOKEN
```

Ou conecte o repositório GitHub diretamente no painel da Vercel.  
O arquivo `vercel.json` garante roteamento limpo (`cleanUrls: true`) e o `vite.config.ts` empacota todas as 9 páginas HTML.

---

## Contribuição

1. Faça fork do repositório
2. Crie uma branch: `git checkout -b feature/minha-funcionalidade`
3. Commit seguindo o padrão: `feat: adiciona autenticação JWT`
4. Push: `git push origin feature/minha-funcionalidade`
5. Abra um Pull Request com descrição detalhada

---

*Developed with ❄️ by the Get Temp team — 2026*
