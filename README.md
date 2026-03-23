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
| Dados (atual) | JSON estático em `/public/mock/esp32_mock.json` |
| Dados (futuro) | MQTT via `mqtt` npm package |
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
│   ├── dataService.ts             ← Abstração de dados (Mock → MQTT-ready)
│   └── style.css                  ← Estilos globais
├── index.html                     ← Dashboard de Status
├── analise.html                   ← Análise Temporal com Filtros
├── relatorios.html                ← Geração e Export de Relatórios
├── detalhes_camara.html           ← Detalhe por Câmara (via ?id=CAM01)
├── ajustes.html                   ← Configurações e Perfil
├── historico_alertas.html         ← Feed de Alertas
├── nova_camara.html               ← Formulário Multipassos (Etapa 1/3)
├── visualizacao_relatorio.html    ← Preview de Relatório Gerado
├── login.html                     ← Tela de Login
├── vite.config.ts                 ← Configuração MPA do Vite
└── vercel.json                    ← Roteamento limpo na Vercel
```

---

## Status das Telas

| Tela | URL | Status | Dados Dinâmicos |
|---|---|---|---|
| Dashboard | `/` | ✅ Funcional | ✅ Câmaras do mock |
| Análise | `/analise` | ✅ Funcional | ✅ Filtros & PDF |
| Relatórios | `/relatorios` | ✅ Funcional | ✅ CSV/JSON/PDF |
| Detalhes Câmara | `/detalhes_camara?id=CAM01` | ✅ Funcional | ✅ Gráfico + Logs |
| Ajustes | `/ajustes` | ⚠️ Parcial | ❌ Estático |
| Histórico Alertas | `/historico_alertas` | ⚠️ Parcial | ❌ Estático |
| Nova Câmara | `/nova_camara` | ⚠️ Parcial | ❌ Formulário sem submit |
| Visualização Relatório | `/visualizacao_relatorio` | ⚠️ Parcial | ❌ Estático |
| Login | `/login` | ⚠️ Parcial | ❌ Sem autenticação |

---

## Funcionalidades Implementadas

### ✅ Dashboard (`index.html`)
- Temperatura ao vivo e nome da câmara principal (CAM01) via mock
- Cards dinâmicos para cada câmara identificada no mock
- Badge de status (Seguro / Aviso / Offline) calculado dinamicamente
- Barra de progresso por câmara
- Navegação para `/detalhes_camara?id=<device_id>`
- Bottom NavBar e Top AppBar injetados via `main.ts`

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

### ✅ Ajustes (`ajustes.html`)
- Toggles de notificação com feedback visual via toast nativo
- Botão "Editar Perfil" → placeholder (alert)
- Botão "Sair" → redireciona para `/login`
- Botão "Nova Câmara" → redireciona para `/nova_camara`

---

## 🚧 Roadmap — Funcionalidades Pendentes

### 🔴 Crítico (Bloqueia Lançamento)

#### `login.html` — Tela de Login
- [ ] **Botão "Entrar"**: sem lógica de autenticação real. Atualmente não faz nada.
- [ ] **Campo E-mail e Senha**: sem validação de formulário
- [ ] **Integração de Auth**: conectar a um provider (Firebase Auth, Supabase, ou JWT simples)
- [ ] **Redirecionamento pós-login**: redirecionar para `index.html` após autenticação bem-sucedida
- [ ] **Proteção de Rotas**: bloquear acesso a páginas protegidas sem token de sessão

#### `nova_camara.html` — Formulário de Cadastro
- [ ] **Botão "PRÓXIMO"**: sem lógica de navegação entre etapas (Etapa 1 de 3 visível, mas etapas 2 e 3 inexistentes)
- [ ] **Etapa 2 e Etapa 3**: telas de configuração de rede e confirmação não criadas
- [ ] **Sliders de Temperatura Min/Max**: atualmente são elementos HTML estáticos (sem evento `input`)
- [ ] **Persistência de Dados**: submissão do formulário não persiste nada (sem API / localStorage)
- [ ] **Validação**: formulário sem validação de campos obrigatórios

### 🟠 Alta Prioridade

#### `historico_alertas.html` — Feed de Alertas
- [ ] **Dados Estáticos**: todos os cards de alertas são HTML fixo. Precisam ser populados do mock (ou MQTT)
- [ ] **Barra de busca**: campo de texto presente mas sem listener de `input`
- [ ] **Filtros de Categoria** ("Tudo" / "Críticos" / "Avisos"): botões sem listener de click
- [ ] **Botão "Filtrar"**: ícone de filtro sem funcionalidade de filtro avançado
- [ ] **Ação nos cards**: nenhum card de alerta é clicável ou navegável para detalhe

#### `visualizacao_relatorio.html` — Preview de Relatório
- [ ] **Dados Estáticos**: todo o conteúdo (temperatura, datas, tabela semanal) é hardcoded
- [ ] **Botão "Baixar PDF"**: presente mas sem event listener — não dispara nenhuma ação
- [ ] **Botão "E-mail"**: presente mas sem funcionalidade (requer integração com backend de e-mail)
- [ ] **Paginação**: exibe "PÁGINA 1 DE 12" mas sem lógica de páginas
- [ ] **Binding com relatório gerado**: página deveria receber o relatório selecionado via query param ou state

#### `ajustes.html` — Configurações Avançadas
- [ ] **Câmaras Registradas**: cards de câmara (Congelador A, Refrigerador B, etc.) são estáticos e não refletem o mock
- [ ] **Botão "Mais" (⋮) nos cards de câmara**: sem menu de contexto (editar, remover)
- [ ] **Editar Perfil**: atualmente exibe apenas um `alert()` placeholder; deveria abrir formulário real
- [ ] **Persistência de Preferências de Notificação**: estado dos toggles não é salvo entre sessões

### 🟡 Médio Prazo

#### `analise.html` — Melhorias de UX
- [ ] **Seleção "Todas as Câmaras"**: opção "ALL" no dropdown não exibe um gráfico consolidado unificado
- [ ] **Gráfico com Eixos e Labels**: o gráfico SVG atual não exibe legendas de temperatura ou timestamps nos eixos
- [ ] **Cards de Alerta Clicáveis**: logs de alerta poderiam navegar para detalhe da câmara correspondente

#### `detalhes_camara.html` — Melhorias
- [ ] **Botão de ações (editar câmara)**: cabeçalho da página pode ter botão de ação adicional
- [ ] **Seletor de Período no Detalhe**: gráfico exibe todos os registros sem filtro de período

#### `relatorios.html` — Melhorias
- [ ] **Visualizar Relatório**: botão que navega para `visualizacao_relatorio` mostrando o relatório gerado
- [ ] **Download de Relatórios Recentes**: ícone de download no hover dos "Relatórios Recentes" não dispara download real

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

- [ ] Toggle de "Alertas de Temperatura Crítica" exibe toast quando alterado
- [ ] Toggle de "Resumos Diários" exibe toast quando alterado
- [ ] Botão "Editar Perfil" exibe mensagem de funcionalidade futura
- [ ] Botão "Sair" redireciona para `/login`
- [ ] Botão "Nova Câmara" redireciona para `/nova_camara`

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

## Integração MQTT (Guia Futuro)

O arquivo `src/dataService.ts` está preparado para substituição do mock por MQTT:

```typescript
// 1. No dataService.ts, altere:
const USE_MOCK = false; // de true para false

// 2. Descomente e configure:
const MQTT_CONFIG = {
  brokerUrl: 'wss://seu-broker:8083/mqtt',
  topic: 'coldchain/readings/#',
  username: 'user',
  password: 'pass',
};

// 3. Instale o pacote:
// npm install mqtt

// 4. Implemente o subscriber no bloco comentado em dataService.ts
// O resto da aplicação (main.ts, todas as telas) funciona sem modificações.
```

### Formato esperado da mensagem MQTT (mesmo schema do mock):

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
