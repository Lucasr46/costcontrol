const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const fmtCurrency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const fmtMonth = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });
const LEGACY_STORAGE_KEY = "cost-control-v2-state";
const CACHE_STORAGE_KEY = "cost-control-v2-cache";
const MONTH_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const CURRENT_MONTH = new Date().toISOString().slice(0, 7);
const CONFIG = window.COST_CONTROL_CONFIG || {};

const DEMO_PLANNING = {
  "2026-02": { income: 5000, fixed: 50, variable: 30, investment: 20 },
  "2026-03": { income: 5000, fixed: 50, variable: 30, investment: 20 },
  "2026-04": { income: 5000, fixed: 50, variable: 30, investment: 20 },
};

const EMPTY_PLANNING = {
  [CURRENT_MONTH]: { income: 0, fixed: 50, variable: 30, investment: 20 },
};

const DEFAULT_CATEGORIES = [
  { id: "salario", name: "Salário", group: "income", costType: "income" },
  { id: "bonus", name: "Bônus", group: "income", costType: "income" },
  { id: "carro", name: "Carro", group: "expense", costType: "fixed" },
  { id: "lazer", name: "Lazer", group: "expense", costType: "variable" },
  { id: "transporte", name: "Transporte", group: "expense", costType: "variable" },
  { id: "celular", name: "Celular", group: "expense", costType: "fixed" },
  { id: "outros", name: "Outros", group: "expense", costType: "variable" },
  { id: "renda-fixa", name: "Renda fixa", group: "investment", costType: "investment" },
  { id: "acao", name: "Ação", group: "investment", costType: "investment" },
];

const views = {
  dashboard: ["Dashboard", "Visão geral financeira"],
  planning: ["Planejamento", "Distribuição da renda mensal"],
  launches: ["Lançamentos", "Receitas, despesas e investimentos"],
  categories: ["Categorias", "Gestão modular"],
  reports: ["Relatórios", "Análise por categoria"],
  history: ["Histórico", "Rastreabilidade das movimentações"],
};

const state = {
  serviceMode: "remote",
  isConfigured: Boolean(CONFIG.supabaseUrl && CONFIG.supabaseAnonKey),
  isAuthenticated: false,
  session: null,
  currentUser: null,
  authMode: "signin",
  syncTone: "idle",
  syncMessage: "Aguardando autenticação.",
  selectedMonth: CURRENT_MONTH,
  editingTransactionId: null,
  editingCategoryId: null,
  dashboardCategoryId: "",
  filters: {
    reports: { dateRange: "selected_month", type: "all", categoryId: "all" },
    history: { dateRange: "selected_month", type: "all", categoryId: "all" },
  },
  planning: structuredClone(EMPTY_PLANNING),
  categories: structuredClone(DEFAULT_CATEGORIES),
  transactions: [],
};

let supabaseClient = null;
let authListenerBound = false;
let isRendering = false;

function money(value) {
  return fmtCurrency.format(Number(value || 0));
}

function cap(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatDate(dateStr) {
  return dateStr ? new Date(`${dateStr}T00:00:00`).toLocaleDateString("pt-BR") : "-";
}

function monthLabel(key) {
  const [year, month] = key.split("-").map(Number);
  return cap(fmtMonth.format(new Date(year, month - 1, 1)));
}

function defaultTransactionDate(monthKeyValue = state.selectedMonth) {
  return `${monthKeyValue}-10`;
}

function monthKey(date) {
  return date.slice(0, 7);
}

function shortMonthLabel(key) {
  return MONTH_LABELS[Number(key.slice(5, 7)) - 1];
}

function addMonths(dateStr, count) {
  const date = new Date(`${dateStr}T00:00:00`);
  date.setMonth(date.getMonth() + count);
  return date.toISOString().slice(0, 10);
}

function slug(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function uid(prefix = "id") {
  if (window.crypto?.randomUUID) return `${prefix}-${window.crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function category(id) {
  return state.categories.find((item) => item.id === id);
}

function txLabel(type) {
  return type === "income" ? "Receita" : type === "expense" ? "Despesa" : "Investimento";
}

function groupLabel(group) {
  return group === "income" ? "Receita" : group === "expense" ? "Despesa" : "Investimento";
}

function typeLabel(type) {
  if (type === "fixed") return "Fixo";
  if (type === "variable") return "Variável";
  if (type === "income") return "Receita";
  return "Investimento";
}

function progress(value, total) {
  return total ? Math.min(Math.round((value / total) * 100), 100) : 0;
}

function defaultTransactions() {
  return [
    { id: "r1", type: "income", description: "Salário", amount: 5000, date: "2026-04-05", categoryId: "salario", competence: "2026-04", periodicity: "single", installments: 1, recurrenceMonths: 1 },
    { id: "d1", type: "expense", description: "Abastecimento", amount: 720, date: "2026-04-09", categoryId: "carro", typeCost: "fixed", competence: "2026-04", installment: 1, installmentCount: 1, periodicity: "single", installments: 1, recurrenceMonths: 1 },
    { id: "d2", type: "expense", description: "Seguro do carro", amount: 460, date: "2026-04-02", categoryId: "carro", typeCost: "fixed", competence: "2026-04", installment: 1, installmentCount: 1, periodicity: "single", installments: 1, recurrenceMonths: 1 },
    { id: "d3", type: "expense", description: "Plano de celular", amount: 120, date: "2026-04-03", categoryId: "celular", typeCost: "fixed", competence: "2026-04", installment: 1, installmentCount: 1, periodicity: "single", installments: 1, recurrenceMonths: 1 },
    { id: "d4", type: "expense", description: "Fim de semana", amount: 580, date: "2026-04-12", categoryId: "lazer", typeCost: "variable", competence: "2026-04", installment: 1, installmentCount: 1, periodicity: "single", installments: 1, recurrenceMonths: 1 },
    { id: "d5", type: "expense", description: "Passagens", amount: 310, date: "2026-04-08", categoryId: "transporte", typeCost: "variable", competence: "2026-04", installment: 1, installmentCount: 1, periodicity: "single", installments: 1, recurrenceMonths: 1 },
    { id: "i1", type: "investment", description: "Aporte mensal", amount: 600, date: "2026-04-15", categoryId: "renda-fixa", competence: "2026-04", periodicity: "single", installments: 1, recurrenceMonths: 1 },
    { id: "i2", type: "investment", description: "Compra de ação", amount: 200, date: "2026-04-18", categoryId: "acao", competence: "2026-04", periodicity: "single", installments: 1, recurrenceMonths: 1 },
  ];
}

function legacySnapshot() {
  try {
    return JSON.parse(window.localStorage.getItem(LEGACY_STORAGE_KEY) || "null");
  } catch {
    return null;
  }
}

function cacheSnapshot() {
  try {
    return JSON.parse(window.localStorage.getItem(CACHE_STORAGE_KEY) || "null");
  } catch {
    return null;
  }
}

function applySnapshot(snapshot, fallbackToDemo = false) {
  state.selectedMonth = snapshot?.selectedMonth || CURRENT_MONTH;
  state.dashboardCategoryId = snapshot?.dashboardCategoryId || "";
  state.filters = snapshot?.filters || {
    reports: { dateRange: "selected_month", type: "all", categoryId: "all" },
    history: { dateRange: "selected_month", type: "all", categoryId: "all" },
  };
  state.planning = snapshot?.planning && Object.keys(snapshot.planning).length
    ? snapshot.planning
    : structuredClone(fallbackToDemo ? DEMO_PLANNING : EMPTY_PLANNING);
  state.categories = Array.isArray(snapshot?.categories) && snapshot.categories.length
    ? snapshot.categories
    : structuredClone(DEFAULT_CATEGORIES);
  state.transactions = Array.isArray(snapshot?.transactions)
    ? snapshot.transactions
    : fallbackToDemo
      ? defaultTransactions()
      : [];
}

function buildSnapshot() {
  return {
    selectedMonth: state.selectedMonth,
    dashboardCategoryId: state.dashboardCategoryId,
    filters: state.filters,
    planning: state.planning,
    categories: state.categories,
    transactions: state.transactions,
  };
}

function saveLocalCache() {
  window.localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(buildSnapshot()));
}

function clearAuthUrlState() {
  const cleanUrl = `${window.location.origin}${window.location.pathname}`;
  window.history.replaceState({}, document.title, cleanUrl);
}

function parseAuthFeedbackFromUrl() {
  const source = `${window.location.hash}${window.location.search}`;
  if (!source || (!source.includes("error=") && !source.includes("error_code="))) return "";

  const normalized = source
    .replace(/^#/, "")
    .replace(/^\?/, "")
    .replace(/#/g, "&")
    .replace(/\?/g, "&");
  const params = new URLSearchParams(normalized);
  const code = params.get("error_code") || "";
  const description = decodeURIComponent((params.get("error_description") || "").replace(/\+/g, " "));

  clearAuthUrlState();

  if (code === "otp_expired" || description.toLowerCase().includes("expired")) {
    return "Seu link de acesso expirou. Solicite um novo e-mail e use apenas o link mais recente.";
  }

  if (description.toLowerCase().includes("rate limit")) {
    return "Você fez várias tentativas em sequência. Aguarde alguns minutos antes de pedir um novo link.";
  }

  if (description) {
    return description;
  }

  return "Não foi possível concluir o login com o link enviado. Tente gerar um novo acesso.";
}

function setSyncState(tone, message) {
  state.syncTone = tone;
  state.syncMessage = message;
  updateSessionPanel();
}

function hasRemote() {
  return Boolean(supabaseClient && state.isConfigured && state.isAuthenticated);
}

function createSupabaseClient() {
  if (!state.isConfigured || !window.supabase?.createClient) return null;
  return window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

function showLoading(message) {
  $("#loading-message").textContent = message;
  $("#app-loading").hidden = false;
  $("#auth-shell").hidden = true;
  $("#app-shell").hidden = true;
}

function showAuth(options = {}) {
  $("#app-loading").hidden = true;
  $("#app-shell").hidden = true;
  $("#auth-shell").hidden = false;
  $("#setup-note").hidden = !options.showSetup;
  const feedback = $("#auth-feedback");
  if (options.message) {
    feedback.hidden = false;
    feedback.textContent = options.message;
  } else {
    feedback.hidden = true;
    feedback.textContent = "";
  }
}

function showApp() {
  $("#app-loading").hidden = true;
  $("#auth-shell").hidden = true;
  $("#app-shell").hidden = false;
}

function updateSessionPanel() {
  const email = state.currentUser?.email || (state.serviceMode === "demo" ? "Modo demonstração local" : "Sem sessão");
  $("#user-email").textContent = email;
  $("#sync-status").textContent = state.serviceMode === "demo"
    ? "Dados somente neste navegador."
    : state.isAuthenticated
      ? "Sincronização remota ativa."
      : "Aguardando autenticação.";
  $("#sign-out-button").hidden = !(state.isAuthenticated || state.serviceMode === "demo");
}

function ensureSelectedMonth() {
  const year = state.selectedMonth.slice(0, 4);
  const month = state.selectedMonth.slice(5, 7);
  if (!/^\d{4}$/.test(year) || !/^\d{2}$/.test(month)) {
    state.selectedMonth = CURRENT_MONTH;
  }
}

function availableYears() {
  const years = new Set([
    ...Object.keys(state.planning || {}).map((key) => key.slice(0, 4)),
    ...state.transactions.map((item) => (item.competence || item.date || state.selectedMonth).slice(0, 4)),
    state.selectedMonth.slice(0, 4),
  ]);
  return Array.from(years).sort((a, b) => Number(b) - Number(a));
}

function planValues(key = state.selectedMonth) {
  const selected = state.planning[key]
    || state.planning[state.selectedMonth]
    || Object.values(state.planning)[0]
    || { income: 0, fixed: 50, variable: 30, investment: 20 };
  return {
    ...selected,
    fixedValue: (selected.income * selected.fixed) / 100,
    variableValue: (selected.income * selected.variable) / 100,
    investmentValue: (selected.income * selected.investment) / 100,
  };
}

function monthTransactions(key = state.selectedMonth) {
  return state.transactions.filter((item) => item.competence === key);
}

function metrics(key = state.selectedMonth) {
  const items = monthTransactions(key);
  const planning = planValues(key);
  const income = items.filter((item) => item.type === "income").reduce((sum, item) => sum + item.amount, 0);
  const expenses = items.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amount, 0);
  const investments = items.filter((item) => item.type === "investment").reduce((sum, item) => sum + item.amount, 0);
  const fixed = items.filter((item) => item.type === "expense" && item.typeCost === "fixed").reduce((sum, item) => sum + item.amount, 0);
  const variable = items.filter((item) => item.type === "expense" && item.typeCost === "variable").reduce((sum, item) => sum + item.amount, 0);
  return { p: planning, income, expenses, investments, fixed, variable, monthBalance: income - expenses - investments };
}

function groupExpensesByCategory(key = state.selectedMonth) {
  const grouped = {};
  monthTransactions(key).filter((item) => item.type === "expense").forEach((item) => {
    const cat = category(item.categoryId);
    const name = cat ? cat.name : "Sem categoria";
    grouped[name] = {
      categoryId: item.categoryId,
      name,
      type: item.typeCost,
      amount: (grouped[name]?.amount || 0) + item.amount,
    };
  });
  return Object.values(grouped).sort((a, b) => b.amount - a.amount);
}

function expenseTransactionsByCategory(categoryId, key = state.selectedMonth) {
  return monthTransactions(key)
    .filter((item) => item.type === "expense" && item.categoryId === categoryId)
    .sort((a, b) => b.amount - a.amount || b.date.localeCompare(a.date));
}

function dashboardTrendMonths(count = 3, baseMonth = state.selectedMonth) {
  return Array.from({ length: count }, (_, index) => addMonths(`${baseMonth}-01`, index - (count - 1)).slice(0, 7));
}

function expensesByCategoryForMonth(categoryId, key) {
  return monthTransactions(key)
    .filter((item) => item.type === "expense" && (!categoryId || item.categoryId === categoryId))
    .reduce((sum, item) => sum + item.amount, 0);
}

function monthsForDateRange(dateRange, baseMonth = state.selectedMonth) {
  if (dateRange === "all") return null;
  if (dateRange === "selected_month") return [baseMonth];
  if (dateRange === "last_3_months") return dashboardTrendMonths(3, baseMonth);
  if (dateRange === "last_6_months") return dashboardTrendMonths(6, baseMonth);
  if (dateRange === "current_year") {
    const year = baseMonth.slice(0, 4);
    return Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, "0")}`);
  }
  return [baseMonth];
}

function dateRangeLabel(dateRange, baseMonth = state.selectedMonth) {
  if (dateRange === "selected_month") return `Mês selecionado: ${monthLabel(baseMonth)}`;
  if (dateRange === "last_3_months") return `Janela: últimos 3 meses até ${monthLabel(baseMonth)}`;
  if (dateRange === "last_6_months") return `Janela: últimos 6 meses até ${monthLabel(baseMonth)}`;
  if (dateRange === "current_year") return `Ano atual: ${baseMonth.slice(0, 4)}`;
  return "Todos os períodos";
}

function transactionsByFilter(filter) {
  const allowedMonths = monthsForDateRange(filter.dateRange);
  let items = allowedMonths ? state.transactions.filter((item) => allowedMonths.includes(item.competence)) : [...state.transactions];
  if (filter.type !== "all") items = items.filter((item) => item.type === filter.type);
  if (filter.categoryId !== "all") items = items.filter((item) => item.categoryId === filter.categoryId);
  return items;
}

function comparisonByMonth(filter) {
  const explicitMonths = monthsForDateRange(filter.dateRange) || dashboardTrendMonths(6);
  return explicitMonths.map((month) => {
    const items = transactionsByFilter({ ...filter, dateRange: "all" }).filter((item) => item.competence === month);
    return {
      month,
      label: monthLabel(month),
      total: items.reduce((sum, item) => sum + item.amount, 0),
      count: items.length,
    };
  });
}

function percentDelta(currentValue, previousValue) {
  if (!previousValue) return currentValue ? 100 : 0;
  return Math.round(((currentValue - previousValue) / previousValue) * 100);
}

function dashboardInsights(currentMetrics, topCategory) {
  const previousMonth = addMonths(`${state.selectedMonth}-01`, -1).slice(0, 7);
  const previousMetrics = metrics(previousMonth);
  const expenseDelta = percentDelta(currentMetrics.expenses, previousMetrics.expenses);
  const variableRemaining = Math.max(currentMetrics.p.variableValue - currentMetrics.variable, 0);
  const fixedRemaining = Math.max(currentMetrics.p.fixedValue - currentMetrics.fixed, 0);

  return [
    topCategory ? `${topCategory.name} é a categoria com maior impacto no mês.` : "Nenhuma despesa registrada neste mês.",
    `Despesas em ${expenseDelta >= 0 ? "+" : ""}${expenseDelta}% versus ${monthLabel(previousMonth)}.`,
    variableRemaining === 0
      ? "O custo variável já consumiu todo o orçamento planejado."
      : `O custo variável ainda tem ${money(variableRemaining)} disponíveis.`,
    fixedRemaining === 0
      ? "O custo fixo já consumiu todo o orçamento planejado."
      : `O custo fixo ainda tem ${money(fixedRemaining)} de margem.`,
    currentMetrics.investments >= currentMetrics.p.investmentValue
      ? "O investimento do mês já atingiu ou superou o planejado."
      : `Ainda faltam ${money(Math.max(currentMetrics.p.investmentValue - currentMetrics.investments, 0))} para bater o investimento do mês.`,
  ];
}

function row(columns) {
  const div = document.createElement("div");
  div.className = "table-row";
  div.innerHTML = columns.map((column) => `<span>${column}</span>`).join("");
  return div;
}

function rowWithActions(columns, actions) {
  const div = document.createElement("div");
  div.className = "table-row table-row--actions";
  div.innerHTML = columns.map((column) => `<span>${column}</span>`).join("") + `<div class="row-actions">${actions}</div>`;
  return div;
}

function renderPeriodFilter() {
  const selectedYear = state.selectedMonth.slice(0, 4);
  const selectedMonthNumber = state.selectedMonth.slice(5, 7);
  const monthStrip = $("#month-strip");
  const yearButton = $("#period-year-button");
  const yearMenu = $("#period-year-menu");

  yearButton.textContent = selectedYear;
  yearMenu.innerHTML = availableYears()
    .map((year) => `<button type="button" class="year-picker__option ${year === selectedYear ? "year-picker__option--active" : ""}" data-year-option="${year}">${year}</button>`)
    .join("");

  monthStrip.innerHTML = MONTH_LABELS.map((label, index) => {
    const monthValue = String(index + 1).padStart(2, "0");
    const key = `${selectedYear}-${monthValue}`;
    return `<button type="button" class="month-pill ${monthValue === selectedMonthNumber ? "month-pill--active" : ""}" data-month-pill="${key}">${label}</button>`;
  }).join("");

  $$("[data-month-pill]").forEach((button) => {
    button.onclick = () => {
      state.selectedMonth = button.dataset.monthPill;
      state.dashboardCategoryId = "";
      $("#tx-date").value = defaultTransactionDate(state.selectedMonth);
      renderAll();
    };
  });

  $$("[data-year-option]").forEach((button) => {
    button.onclick = () => {
      state.selectedMonth = `${button.dataset.yearOption}-${selectedMonthNumber}`;
      yearMenu.hidden = true;
      $("#period-year-button").setAttribute("aria-expanded", "false");
      state.dashboardCategoryId = "";
      $("#tx-date").value = defaultTransactionDate(state.selectedMonth);
      renderAll();
    };
  });
}

function renderDashboard() {
  const currentMetrics = metrics();
  const topCategory = groupExpensesByCategory()[0];
  const stats = [
    { label: "Saldo do mês", value: money(currentMetrics.monthBalance), detail: "Receitas menos despesas e aportes" },
    { label: "Receitas", value: money(currentMetrics.income), detail: "Salário e renda extra recebidos" },
    { label: "Despesas", value: money(currentMetrics.expenses), detail: "Compromissos lançados no mês", danger: true },
  ];

  $("#stats-grid").innerHTML = stats.map((item) => `
    <article class="card stat">
      <span>${item.label}</span>
      <strong ${item.danger ? 'style="color: var(--danger)"' : ""}>${item.value}</strong>
      <small>${item.detail}</small>
    </article>
  `).join("");

  const budgets = [
    { title: "Custo fixo", used: currentMetrics.fixed, total: currentMetrics.p.fixedValue, percent: progress(currentMetrics.fixed, currentMetrics.p.fixedValue) },
    { title: "Custo variável", used: currentMetrics.variable, total: currentMetrics.p.variableValue, percent: progress(currentMetrics.variable, currentMetrics.p.variableValue) },
    { title: "Investimentos", used: currentMetrics.investments, total: currentMetrics.p.investmentValue, percent: progress(currentMetrics.investments, currentMetrics.p.investmentValue) },
  ];

  $("#budget-grid").innerHTML = budgets.map((item) => `
    <article class="card summary">
      <div class="budget-top">
        <div>
          <p class="eyebrow">${item.title}</p>
          <strong>${money(item.used)} de ${money(item.total)}</strong>
        </div>
        <strong>${item.percent}%</strong>
      </div>
      <div class="progress"><div style="width:${item.percent}%"></div></div>
      <small>Restante: ${money(Math.max(item.total - item.used, 0))}</small>
    </article>
  `).join("");

  const categories = groupExpensesByCategory();
  const maxCategory = categories[0]?.amount || 1;
  $("#category-bars").innerHTML = categories.length
    ? categories.map((item) => `
        <div class="bar-row ${state.dashboardCategoryId === item.categoryId ? "bar-row--active" : ""}" data-category-row="${item.categoryId}">
          <span>${item.name}</span>
          <div class="bar-track"><div style="width:${(item.amount / maxCategory) * 100}%"></div></div>
          <strong>${money(item.amount)}</strong>
        </div>
      `).join("")
    : `<div class="empty-state">Nenhuma despesa lançada no período.</div>`;

  const trendCategoryId = state.dashboardCategoryId || "";
  $("#trend-title").textContent = trendCategoryId ? `Evolução mensal • ${category(trendCategoryId)?.name || "Categoria"}` : "Evolução mensal";
  $("#trend-clear-filter").hidden = !trendCategoryId;
  $("#trend-clear-filter").onclick = () => {
    state.dashboardCategoryId = "";
    renderAll();
  };

  const trendMonths = dashboardTrendMonths(3);
  const trendValues = trendMonths.map((month) => ({
    month,
    label: shortMonthLabel(month),
    total: expensesByCategoryForMonth(trendCategoryId, month),
  }));
  const maxTrend = Math.max(...trendValues.map((item) => item.total), 1);
  $("#trend-columns").innerHTML = `
    <div class="trend__chart">
      ${trendValues.map((item) => `
        <div class="trend__item">
          <div class="trend__bar-wrap">
            <div class="trend__bar" style="height:${Math.max((item.total / maxTrend) * 100, item.total ? 10 : 0)}%"></div>
          </div>
          <strong>${item.label}</strong>
          <small>${money(item.total)}</small>
        </div>
      `).join("")}
    </div>
  `;

  $("#alert-list").innerHTML = dashboardInsights(currentMetrics, topCategory).map((item) => `<li>${item}</li>`).join("");
  $("#sidebar-title").textContent = categories[0]
    ? `${progress(currentMetrics.variable, currentMetrics.p.variableValue)}% do orçamento variável usado`
    : "Sem despesas no mês";
  $("#sidebar-text").textContent = categories[0]
    ? `${categories[0].name} é a categoria com maior impacto no mês.`
    : "Adicione lançamentos para começar a analisar o orçamento.";

  bindCategoryHover();
  bindDashboardCategoryFilter();
}

function bindCategoryHover() {
  const hoverCard = $("#category-hover-card");
  $$("[data-category-row]").forEach((rowElement) => {
    rowElement.addEventListener("mouseenter", () => {
      const categoryId = rowElement.dataset.categoryRow;
      const cat = category(categoryId);
      const items = expenseTransactionsByCategory(categoryId);
      hoverCard.hidden = false;
      hoverCard.innerHTML = `
        <strong>${cat?.name || "Categoria"}</strong>
        <small>${items.length} lançamento(s) no mês selecionado</small>
        <div class="category-hover-card__list">
          ${items.map((item) => `
            <div class="category-hover-card__item">
              <div>
                <strong>${item.description}</strong>
                <small>${formatDate(item.date)}${item.installmentCount > 1 ? ` • ${item.installment}/${item.installmentCount}` : ""}</small>
              </div>
              <span>${money(item.amount)}</span>
            </div>
          `).join("")}
        </div>
      `;
    });
  });

  $("#category-bars").addEventListener("mouseleave", () => {
    hoverCard.hidden = true;
  });
}

function bindDashboardCategoryFilter() {
  $$("[data-category-row]").forEach((rowElement) => {
    rowElement.addEventListener("click", () => {
      const categoryId = rowElement.dataset.categoryRow;
      state.dashboardCategoryId = state.dashboardCategoryId === categoryId ? "" : categoryId;
      renderDashboard();
      saveLocalCache();
      persistPreferences().catch(() => {});
    });
  });
}

function renderPlanning() {
  const planning = planValues();
  $("#planning-title").textContent = `Planejamento de ${monthLabel(state.selectedMonth)}`;
  $("#planning-income").value = planning.income;
  $("#planning-fixed").value = planning.fixed;
  $("#planning-variable").value = planning.variable;
  $("#planning-investment").value = planning.investment;
  $("#planning-summary").innerHTML = `
    <div class="mini-card">
      <span>Custo fixo</span>
      <strong>${money(planning.fixedValue)}</strong>
      <small>${planning.fixed}% da renda do mês</small>
    </div>
    <div class="mini-card">
      <span>Custo variável</span>
      <strong>${money(planning.variableValue)}</strong>
      <small>${planning.variable}% da renda do mês</small>
    </div>
    <div class="mini-card">
      <span>Investimento</span>
      <strong>${money(planning.investmentValue)}</strong>
      <small>${planning.investment}% da renda do mês</small>
    </div>
  `;
}

function renderCategorySelects() {
  const type = $("#tx-type").value;
  const categories = state.categories.filter((item) => item.group === type);
  $("#tx-category").innerHTML = categories.map((item) => `<option value="${item.id}">${item.name}</option>`).join("");
}

function syncTransactionFormState() {
  const periodicity = $("#tx-periodicity").value;
  const installmentField = $("#tx-installments").closest(".field");
  const recurrenceField = $("#tx-recurrence").closest(".field");
  installmentField.hidden = periodicity !== "installment";
  recurrenceField.hidden = periodicity !== "recurring";
  $("#tx-installments").disabled = periodicity !== "installment";
  $("#tx-recurrence").disabled = periodicity !== "recurring";
}

function syncCategoryFormState() {
  const group = $("#category-group").value;
  const costField = $("#category-cost-type-field");
  const submitButton = $("#category-submit-button");
  const cancelButton = $("#category-cancel-button");
  costField.hidden = group !== "expense";
  submitButton.textContent = state.editingCategoryId ? "Salvar categoria" : "Adicionar categoria";
  cancelButton.hidden = !state.editingCategoryId;
}

function renderTransactions() {
  const container = $("#transactions-table");
  const items = monthTransactions()
    .sort((a, b) => b.date.localeCompare(a.date) || b.amount - a.amount);
  container.innerHTML = "";
  if (!items.length) {
    container.append(row(["Nenhum lançamento no mês selecionado.", "-", "-", "-"]));
    return;
  }

  items.forEach((item) => {
    const cat = category(item.categoryId);
    container.append(
      rowWithActions(
        [
          item.description,
          cat?.name || "Sem categoria",
          formatDate(item.date),
          money(item.amount),
        ],
        `
          <button class="button button--ghost button--sm" data-edit-transaction="${item.id}" type="button">Editar</button>
          <button class="button button--danger button--sm" data-delete-transaction="${item.id}" type="button">Excluir</button>
        `
      )
    );
  });
  bindTransactionActions();
}

function renderCategories() {
  const container = $("#category-list");
  container.innerHTML = "";
  state.categories
    .slice()
    .sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name))
    .forEach((item) => {
      const used = state.transactions.some((transaction) => transaction.categoryId === item.id);
      const info = item.group === "expense" ? `${groupLabel(item.group)} • ${typeLabel(item.costType)}` : groupLabel(item.group);
      container.append(
        rowWithActions(
          [item.name, info, used ? "Em uso" : "Livre", ""],
          `
            <button class="button button--ghost button--sm" data-edit-category="${item.id}" type="button">Editar</button>
            <button class="button button--danger button--sm" data-delete-category="${item.id}" type="button">Excluir</button>
          `
        )
      );
    });

  $$("[data-edit-category]").forEach((button) => {
    button.onclick = () => populateCategoryForm(button.dataset.editCategory);
  });

  $$("[data-delete-category]").forEach((button) => {
    button.onclick = async () => {
      const id = button.dataset.deleteCategory;
      const used = state.transactions.some((item) => item.categoryId === id);
      if (used) {
        window.alert("Essa categoria está sendo usada, favor alterá-la na despesa que a utiliza.");
        return;
      }
      state.categories = state.categories.filter((item) => item.id !== id);
      try {
        if (hasRemote()) await deleteCategoryRemote(id);
        renderAll();
      } catch (error) {
        handleSyncError(error, "Não foi possível excluir a categoria.");
      }
    };
  });
}

function groupedTransactionsByCategory(filter) {
  const grouped = {};
  transactionsByFilter(filter).forEach((item) => {
    const cat = category(item.categoryId);
    const name = cat ? cat.name : "Sem categoria";
    grouped[name] = {
      name,
      type: item.type === "expense" ? item.typeCost : item.type,
      amount: (grouped[name]?.amount || 0) + item.amount,
    };
  });
  return Object.values(grouped).sort((a, b) => b.amount - a.amount);
}

function syncFilterOptions() {
  const reportType = state.filters.reports.type;
  const historyType = state.filters.history.type;
  const reportCategory = $("#report-category");
  const historyCategory = $("#history-category");
  const reportCategories = state.categories.filter((item) => reportType === "all" || item.group === reportType);
  const historyCategories = state.categories.filter((item) => historyType === "all" || item.group === historyType);

  reportCategory.innerHTML = ['<option value="all">Todas</option>'].concat(reportCategories.map((item) => `<option value="${item.id}">${item.name}</option>`)).join("");
  historyCategory.innerHTML = ['<option value="all">Todas</option>'].concat(historyCategories.map((item) => `<option value="${item.id}">${item.name}</option>`)).join("");
  reportCategory.value = reportCategories.some((item) => item.id === state.filters.reports.categoryId) ? state.filters.reports.categoryId : "all";
  historyCategory.value = historyCategories.some((item) => item.id === state.filters.history.categoryId) ? state.filters.history.categoryId : "all";
  $("#report-date-range").value = state.filters.reports.dateRange;
  $("#report-type").value = state.filters.reports.type;
  $("#history-date-range").value = state.filters.history.dateRange;
  $("#history-type").value = state.filters.history.type;
}

function renderReports() {
  syncFilterOptions();
  const filter = state.filters.reports;
  const items = transactionsByFilter(filter);
  const grouped = groupedTransactionsByCategory(filter);
  const total = items.reduce((sum, item) => sum + item.amount, 0);
  const topCategory = grouped[0];
  const average = items.length ? total / items.length : 0;

  $("#report-summary-cards").innerHTML = `
    <article class="card mini-card">
      <span>Total filtrado</span>
      <strong>${money(total)}</strong>
      <small>${dateRangeLabel(filter.dateRange)}</small>
    </article>
    <article class="card mini-card">
      <span>Categoria destaque</span>
      <strong>${topCategory?.name || "Sem dados"}</strong>
      <small>${topCategory ? money(topCategory.amount) : "Nenhuma movimentação"}</small>
    </article>
    <article class="card mini-card">
      <span>Ticket médio</span>
      <strong>${money(average)}</strong>
      <small>${items.length} movimentação(ões)</small>
    </article>
  `;

  $("#report-comparison-list").innerHTML = comparisonByMonth(filter)
    .map((item) => `
      <div class="table-row">
        <span>${item.label}</span>
        <span>${item.count} lançamento(s)</span>
        <span>${money(item.total)}</span>
      </div>
    `)
    .join("");

  const container = $("#report-table");
  container.innerHTML = "";
  if (!grouped.length) {
    container.append(row(["Nenhuma categoria encontrada.", "-", "-", "-"]));
    return;
  }

  grouped.forEach((item) => {
    container.append(
      row([
        item.name,
        typeLabel(item.type),
        total ? `${Math.round((item.amount / total) * 100)}%` : "0%",
        money(item.amount),
      ])
    );
  });
}

function renderHistory() {
  syncFilterOptions();
  const items = transactionsByFilter(state.filters.history)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date) || b.amount - a.amount);
  const container = $("#history-table");
  container.innerHTML = "";
  if (!items.length) {
    container.append(row(["Nenhuma movimentação encontrada.", "-", "-", "-"]));
    return;
  }

  items.forEach((item) => {
    container.append(
      rowWithActions(
        [
          item.description,
          txLabel(item.type),
          formatDate(item.date),
          money(item.amount),
        ],
        `
          <button class="button button--ghost button--sm" data-edit-transaction="${item.id}" type="button">Editar</button>
          <button class="button button--danger button--sm" data-delete-transaction="${item.id}" type="button">Excluir</button>
        `
      )
    );
  });
  bindTransactionActions();
}

function renderAll() {
  if (isRendering) return;
  isRendering = true;
  ensureSelectedMonth();
  renderPeriodFilter();
  renderDashboard();
  renderPlanning();
  renderCategorySelects();
  renderTransactions();
  renderCategories();
  renderReports();
  renderHistory();
  updateSessionPanel();
  saveLocalCache();
  persistPreferences().catch(() => {});
  isRendering = false;
}

function resetTransactionForm() {
  state.editingTransactionId = null;
  $("#transaction-form").reset();
  $("#tx-type").value = "expense";
  $("#tx-periodicity").value = "single";
  $("#tx-installments").value = 1;
  $("#tx-recurrence").value = 1;
  $("#tx-date").value = defaultTransactionDate();
  renderCategorySelects();
  syncTransactionFormState();
  $("#tx-submit-button").textContent = "Adicionar lançamento";
  $("#tx-cancel-button").hidden = true;
}

function resetCategoryForm() {
  state.editingCategoryId = null;
  $("#category-form").reset();
  $("#category-group").value = "income";
  $("#category-cost-type").value = "variable";
  syncCategoryFormState();
}

function populateCategoryForm(categoryId) {
  const item = state.categories.find((categoryItem) => categoryItem.id === categoryId);
  if (!item) return;
  state.editingCategoryId = categoryId;
  $("#category-name").value = item.name;
  $("#category-group").value = item.group;
  $("#category-cost-type").value = item.costType === "fixed" ? "fixed" : "variable";
  $("#category-submit-button").textContent = "Salvar categoria";
  $("#category-cancel-button").hidden = false;
  syncCategoryFormState();
  activateView("categories");
}

function populateTransactionForm(transactionId) {
  const transaction = state.transactions.find((item) => item.id === transactionId);
  if (!transaction) return;
  state.editingTransactionId = transactionId;
  $("#tx-type").value = transaction.type;
  renderCategorySelects();
  $("#tx-amount").value = transaction.amount;
  $("#tx-description").value = transaction.description;
  $("#tx-date").value = transaction.date;
  $("#tx-category").value = transaction.categoryId;
  $("#tx-periodicity").value = transaction.installmentCount > 1 ? "installment" : transaction.periodicity || "single";
  $("#tx-installments").value = transaction.installmentCount || transaction.installments || 1;
  $("#tx-recurrence").value = transaction.recurrenceMonths || 1;
  $("#tx-submit-button").textContent = "Salvar lançamento";
  $("#tx-cancel-button").hidden = false;
  syncTransactionFormState();
}

function bindTransactionActions() {
  $$("[data-edit-transaction]").forEach((button) => {
    button.onclick = () => {
      populateTransactionForm(button.dataset.editTransaction);
      activateView("launches");
    };
  });

  $$("[data-delete-transaction]").forEach((button) => {
    button.onclick = async () => {
      const id = button.dataset.deleteTransaction;
      state.transactions = state.transactions.filter((item) => item.id !== id);
      if (state.editingTransactionId === id) resetTransactionForm();
      try {
        if (hasRemote()) await deleteTransactionsRemote([id]);
        renderAll();
      } catch (error) {
        handleSyncError(error, "Não foi possível excluir o lançamento.");
      }
    };
  });
}

function activateView(name) {
  $$(".nav__item").forEach((item) => item.classList.toggle("nav__item--active", item.dataset.view === name));
  $$(".view").forEach((view) => view.classList.toggle("view--active", view.dataset.panel === name));
  $("#view-title").textContent = views[name][0];
  $("#view-eyebrow").textContent = views[name][1];
}

function bindNav() {
  $$(".nav__item").forEach((item) => {
    item.addEventListener("click", () => activateView(item.dataset.view));
  });
  $("#go-launches").addEventListener("click", () => activateView("launches"));
}

function bindPeriodFilter() {
  const yearButton = $("#period-year-button");
  const yearMenu = $("#period-year-menu");
  yearButton.onclick = (event) => {
    event.stopPropagation();
    const willOpen = yearMenu.hidden;
    yearMenu.hidden = !willOpen;
    yearButton.setAttribute("aria-expanded", String(willOpen));
  };
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".year-picker")) {
      yearMenu.hidden = true;
      yearButton.setAttribute("aria-expanded", "false");
    }
  });
}

function bindAuth() {
  $("#auth-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = $("#auth-email").value.trim();
    if (!email) return;
    if (!state.isConfigured || !supabaseClient) {
      showAuth({ showSetup: true, message: "Configure o Supabase antes de enviar o link mágico." });
      return;
    }

    $("#auth-submit-button").disabled = true;
    try {
      const redirectTo = CONFIG.authRedirectTo || `${window.location.origin}${window.location.pathname}`;
      const { error } = await supabaseClient.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo },
      });
      if (error) throw error;
      showAuth({ message: "Link enviado. Abra o e-mail neste dispositivo ou em outro para acessar sua conta." });
    } catch (error) {
      showAuth({ message: error.message || "Não foi possível enviar o link de acesso.", showSetup: !state.isConfigured });
    } finally {
      $("#auth-submit-button").disabled = false;
    }
  });

  $("#demo-mode-button").addEventListener("click", () => {
    state.serviceMode = "demo";
    state.isAuthenticated = false;
    state.session = null;
    state.currentUser = null;
    applySnapshot(cacheSnapshot() || legacySnapshot(), true);
    showApp();
    resetTransactionForm();
    resetCategoryForm();
    renderAll();
  });

  $("#sign-out-button").addEventListener("click", async () => {
    if (state.serviceMode === "demo") {
      showAuth({ showSetup: !state.isConfigured });
      return;
    }
    if (!supabaseClient) return;
    await supabaseClient.auth.signOut();
  });
}

function bindForms() {
  $("#planning-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const income = Number($("#planning-income").value || 0);
    const fixed = Number($("#planning-fixed").value || 0);
    const variable = Number($("#planning-variable").value || 0);
    const investment = Number($("#planning-investment").value || 0);
    if (fixed + variable + investment !== 100) {
      window.alert("A soma dos percentuais precisa ser exatamente 100%.");
      return;
    }

    state.planning[state.selectedMonth] = { income, fixed, variable, investment };
    try {
      if (hasRemote()) await upsertPlanningRemote(state.selectedMonth, state.planning[state.selectedMonth]);
      renderAll();
    } catch (error) {
      handleSyncError(error, "Não foi possível salvar o planejamento.");
    }
  });

  $("#tx-type").addEventListener("change", renderCategorySelects);
  $("#tx-periodicity").addEventListener("change", syncTransactionFormState);
  $("#tx-cancel-button").addEventListener("click", resetTransactionForm);
  $("#category-group").addEventListener("change", syncCategoryFormState);
  $("#category-cancel-button").addEventListener("click", resetCategoryForm);
  $("#report-date-range").addEventListener("change", (event) => {
    state.filters.reports.dateRange = event.target.value;
    renderAll();
  });
  $("#report-type").addEventListener("change", (event) => {
    state.filters.reports.type = event.target.value;
    state.filters.reports.categoryId = "all";
    renderAll();
  });
  $("#report-category").addEventListener("change", (event) => {
    state.filters.reports.categoryId = event.target.value;
    renderAll();
  });
  $("#history-date-range").addEventListener("change", (event) => {
    state.filters.history.dateRange = event.target.value;
    renderAll();
  });
  $("#history-type").addEventListener("change", (event) => {
    state.filters.history.type = event.target.value;
    state.filters.history.categoryId = "all";
    renderAll();
  });
  $("#history-category").addEventListener("change", (event) => {
    state.filters.history.categoryId = event.target.value;
    renderAll();
  });

  $("#transaction-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const type = $("#tx-type").value;
    const amount = Number($("#tx-amount").value || 0);
    const description = $("#tx-description").value.trim();
    const date = $("#tx-date").value;
    const categoryId = $("#tx-category").value;
    const periodicity = $("#tx-periodicity").value;
    const installments = Math.max(Number($("#tx-installments").value || 1), 1);
    const recurrenceMonths = Math.max(Number($("#tx-recurrence").value || 1), 1);

    try {
      if (state.editingTransactionId) {
        state.transactions = state.transactions.map((item) => {
          if (item.id !== state.editingTransactionId) return item;
          const updated = {
            ...item,
            type,
            description,
            amount,
            date,
            categoryId,
            competence: monthKey(date),
            periodicity,
            installments,
            recurrenceMonths,
          };
          if (type === "expense") updated.typeCost = category(categoryId)?.costType || "variable";
          return updated;
        });
        if (hasRemote()) {
          const updatedRecord = state.transactions.find((item) => item.id === state.editingTransactionId);
          await upsertTransactionsRemote([updatedRecord]);
        }
        resetTransactionForm();
        renderAll();
        return;
      }

      const createdRecords = [];
      for (let recurrenceIndex = 0; recurrenceIndex < recurrenceMonths; recurrenceIndex += 1) {
        const recurringDate = addMonths(date, recurrenceIndex);
        if (type === "expense" && periodicity === "installment") {
          const perInstallment = Number((amount / installments).toFixed(2));
          for (let installmentIndex = 0; installmentIndex < installments; installmentIndex += 1) {
            const competence = addMonths(recurringDate, installmentIndex).slice(0, 7);
            createdRecords.push({
              id: uid("tx"),
              type,
              description,
              amount: perInstallment,
              date: recurringDate,
              categoryId,
              competence,
              typeCost: category(categoryId)?.costType || "variable",
              installment: installmentIndex + 1,
              installmentCount: installments,
              periodicity,
              installments,
              recurrenceMonths,
            });
          }
        } else {
          createdRecords.push({
            id: uid("tx"),
            type,
            description,
            amount,
            date: recurringDate,
            categoryId,
            competence: monthKey(recurringDate),
            typeCost: type === "expense" ? category(categoryId)?.costType || "variable" : undefined,
            installment: 1,
            installmentCount: 1,
            periodicity,
            installments: 1,
            recurrenceMonths,
          });
        }
        if (periodicity !== "recurring") break;
      }

      state.transactions.push(...createdRecords);
      if (hasRemote()) await upsertTransactionsRemote(createdRecords);
      resetTransactionForm();
      renderAll();
    } catch (error) {
      handleSyncError(error, "Não foi possível salvar o lançamento.");
    }
  });

  $("#category-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = $("#category-name").value.trim();
    const group = $("#category-group").value;
    const costType = group === "expense" ? $("#category-cost-type").value : group === "income" ? "income" : "investment";

    try {
      if (state.editingCategoryId) {
        const current = state.categories.find((item) => item.id === state.editingCategoryId);
        const used = state.transactions.some((item) => item.categoryId === state.editingCategoryId);
        if (current && used && current.group !== group) {
          window.alert("Não é possível mudar o tipo de uma categoria que já está sendo usada. Você pode alterar o nome e, nas despesas, trocar entre custo fixo e variável.");
          return;
        }

        state.categories = state.categories.map((item) => item.id === state.editingCategoryId ? { ...item, name, group, costType } : item);
        state.transactions = state.transactions.map((item) => {
          if (item.categoryId !== state.editingCategoryId || group !== "expense") return item;
          return { ...item, typeCost: costType };
        });

        if (hasRemote()) {
          const updatedCategory = state.categories.find((item) => item.id === state.editingCategoryId);
          const impactedTransactions = state.transactions.filter((item) => item.categoryId === state.editingCategoryId);
          await upsertCategoriesRemote([updatedCategory]);
          if (impactedTransactions.length) await upsertTransactionsRemote(impactedTransactions);
        }
        resetCategoryForm();
        renderAll();
        return;
      }

      const createdCategory = {
        id: `${slug(name)}-${Date.now()}`,
        name,
        group,
        costType,
      };
      state.categories.push(createdCategory);
      if (hasRemote()) await upsertCategoriesRemote([createdCategory]);
      resetCategoryForm();
      renderAll();
    } catch (error) {
      handleSyncError(error, "Não foi possível salvar a categoria.");
    }
  });
}

function handleSyncError(error, fallbackMessage) {
  console.error(error);
  window.alert(error?.message || fallbackMessage);
}

function toRemoteCategory(item) {
  return {
    id: item.id,
    user_id: state.currentUser.id,
    name: item.name,
    type: item.group,
    cost_classification: item.group === "expense" ? item.costType : null,
  };
}

function toRemotePlan(monthKeyValue, item) {
  return {
    user_id: state.currentUser.id,
    month_key: monthKeyValue,
    income_amount: item.income,
    fixed_percent: item.fixed,
    variable_percent: item.variable,
    investment_percent: item.investment,
  };
}

function toRemoteTransaction(item) {
  return {
    id: item.id,
    user_id: state.currentUser.id,
    type: item.type,
    description: item.description,
    amount: item.amount,
    date: item.date,
    category_id: item.categoryId,
    competence: item.competence,
    periodicity: item.periodicity || "single",
    installments: item.installments || item.installmentCount || 1,
    recurrence_months: item.recurrenceMonths || 1,
    installment_number: item.installment || 1,
    type_cost: item.typeCost || null,
  };
}

function fromRemoteCategory(item) {
  return {
    id: item.id,
    name: item.name,
    group: item.type,
    costType: item.type === "expense" ? item.cost_classification || "variable" : item.type,
  };
}

function fromRemotePlan(item) {
  return [
    item.month_key,
    {
      income: Number(item.income_amount || 0),
      fixed: Number(item.fixed_percent || 0),
      variable: Number(item.variable_percent || 0),
      investment: Number(item.investment_percent || 0),
    },
  ];
}

function fromRemoteTransaction(item) {
  return {
    id: item.id,
    type: item.type,
    description: item.description,
    amount: Number(item.amount || 0),
    date: item.date,
    categoryId: item.category_id,
    competence: item.competence,
    periodicity: item.periodicity || "single",
    installments: item.installments || 1,
    recurrenceMonths: item.recurrence_months || 1,
    installment: item.installment_number || 1,
    installmentCount: item.installments || 1,
    typeCost: item.type_cost || undefined,
  };
}

async function ensureProfile() {
  await supabaseClient.from("profiles").upsert({
    user_id: state.currentUser.id,
    email: state.currentUser.email,
  });
}

async function seedDefaultsIfNeeded(categories) {
  if (!categories.length) {
    await upsertCategoriesRemote(DEFAULT_CATEGORIES);
  }
}

async function fetchRemoteState() {
  const [plansResult, categoriesResult, transactionsResult, preferencesResult] = await Promise.all([
    supabaseClient.from("monthly_plans").select("*").eq("user_id", state.currentUser.id),
    supabaseClient.from("categories").select("*").eq("user_id", state.currentUser.id).order("name"),
    supabaseClient.from("transactions").select("*").eq("user_id", state.currentUser.id).order("date", { ascending: false }),
    supabaseClient.from("app_preferences").select("*").eq("user_id", state.currentUser.id).maybeSingle(),
  ]);

  const errors = [plansResult.error, categoriesResult.error, transactionsResult.error, preferencesResult.error].filter(Boolean);
  if (errors.length) throw errors[0];

  return {
    planning: Object.fromEntries((plansResult.data || []).map(fromRemotePlan)),
    categories: (categoriesResult.data || []).map(fromRemoteCategory),
    transactions: (transactionsResult.data || []).map(fromRemoteTransaction),
    preferences: preferencesResult.data,
  };
}

async function migrateLegacyLocalStateIfNeeded(remoteState) {
  const legacy = legacySnapshot() || cacheSnapshot();
  if (!legacy) return remoteState;
  const hasRemoteData = remoteState.categories.length || remoteState.transactions.length || Object.keys(remoteState.planning).length;
  if (hasRemoteData) return remoteState;

  const snapshot = {
    selectedMonth: legacy.selectedMonth || CURRENT_MONTH,
    dashboardCategoryId: legacy.dashboardCategoryId || "",
    filters: legacy.filters || state.filters,
    planning: legacy.planning || {},
    categories: legacy.categories || structuredClone(DEFAULT_CATEGORIES),
    transactions: legacy.transactions || [],
  };

  await upsertCategoriesRemote(snapshot.categories);
  await Promise.all(Object.entries(snapshot.planning).map(([key, value]) => upsertPlanningRemote(key, value)));
  if (snapshot.transactions.length) await upsertTransactionsRemote(snapshot.transactions);
  await upsertPreferencesRemote({
    selected_month: snapshot.selectedMonth,
    filters: snapshot.filters,
    dashboard_category_id: snapshot.dashboardCategoryId || null,
  });
  return fetchRemoteState();
}

async function upsertCategoriesRemote(items) {
  if (!items.length) return;
  const { error } = await supabaseClient.from("categories").upsert(items.map(toRemoteCategory), { onConflict: "user_id,id" });
  if (error) throw error;
}

async function deleteCategoryRemote(id) {
  const { error } = await supabaseClient.from("categories").delete().eq("user_id", state.currentUser.id).eq("id", id);
  if (error) throw error;
}

async function upsertPlanningRemote(monthKeyValue, planningItem) {
  const { error } = await supabaseClient.from("monthly_plans").upsert(toRemotePlan(monthKeyValue, planningItem), { onConflict: "user_id,month_key" });
  if (error) throw error;
}

async function upsertTransactionsRemote(items) {
  if (!items.length) return;
  const { error } = await supabaseClient.from("transactions").upsert(items.map(toRemoteTransaction));
  if (error) throw error;
}

async function deleteTransactionsRemote(ids) {
  if (!ids.length) return;
  const { error } = await supabaseClient.from("transactions").delete().eq("user_id", state.currentUser.id).in("id", ids);
  if (error) throw error;
}

async function upsertPreferencesRemote(payload) {
  const { error } = await supabaseClient.from("app_preferences").upsert({
    user_id: state.currentUser.id,
    ...payload,
  });
  if (error) throw error;
}

async function persistPreferences() {
  saveLocalCache();
  if (!hasRemote()) return;
  await upsertPreferencesRemote({
    selected_month: state.selectedMonth,
    filters: state.filters,
    dashboard_category_id: state.dashboardCategoryId || null,
  });
}

async function bootAuthenticatedApp(session) {
  state.serviceMode = "remote";
  state.session = session;
  state.currentUser = session.user;
  state.isAuthenticated = true;
  showLoading("Carregando seus dados...");
  await ensureProfile();
  let remoteState = await fetchRemoteState();
  await seedDefaultsIfNeeded(remoteState.categories);
  remoteState = await fetchRemoteState();
  remoteState = await migrateLegacyLocalStateIfNeeded(remoteState);

  state.selectedMonth = remoteState.preferences?.selected_month || remoteState.transactions[0]?.competence || CURRENT_MONTH;
  state.dashboardCategoryId = remoteState.preferences?.dashboard_category_id || "";
  state.filters = remoteState.preferences?.filters || state.filters;
  state.planning = Object.keys(remoteState.planning).length ? remoteState.planning : structuredClone(EMPTY_PLANNING);
  state.categories = remoteState.categories.length ? remoteState.categories : structuredClone(DEFAULT_CATEGORIES);
  state.transactions = remoteState.transactions;

  showApp();
  resetTransactionForm();
  resetCategoryForm();
  renderAll();
}

function updateSessionPanel() {
  const email = state.currentUser?.email || (state.serviceMode === "demo" ? "Modo demonstração local" : "Sem sessão");
  $("#user-email").textContent = email;
  $("#session-pill").textContent = state.serviceMode === "demo"
    ? "Local"
    : state.syncTone === "saving"
      ? "Sincronizando"
      : state.syncTone === "synced"
        ? "Online"
        : state.syncTone === "error"
          ? "Atenção"
          : state.isAuthenticated
            ? "Conta ativa"
            : "Offline";
  $("#sync-status").textContent = state.serviceMode === "demo"
    ? "Dados somente neste navegador."
    : state.syncMessage || (state.isAuthenticated ? "Sincronização remota ativa." : "Aguardando autenticação.");
  $(".session-panel").dataset.syncTone = state.serviceMode === "demo" ? "idle" : state.syncTone;
  $("#sign-out-button").hidden = !(state.isAuthenticated || state.serviceMode === "demo");
}

function handleSyncError(error, fallbackMessage) {
  console.error(error);
  setSyncState("error", "Não foi possível sincronizar agora. Você pode tentar novamente em instantes.");
  window.alert(error?.message || fallbackMessage);
}

async function persistPreferences() {
  saveLocalCache();
  if (!hasRemote()) return;
  setSyncState("saving", "Sincronizando mudanças...");
  await upsertPreferencesRemote({
    selected_month: state.selectedMonth,
    filters: state.filters,
    dashboard_category_id: state.dashboardCategoryId || null,
  });
  setSyncState("synced", "Tudo sincronizado com sua conta.");
}

async function bootAuthenticatedApp(session) {
  state.serviceMode = "remote";
  state.session = session;
  state.currentUser = session.user;
  state.isAuthenticated = true;
  setSyncState("loading", "Carregando seus dados...");
  showLoading("Carregando seus dados...");
  await ensureProfile();
  let remoteState = await fetchRemoteState();
  await seedDefaultsIfNeeded(remoteState.categories);
  remoteState = await fetchRemoteState();
  remoteState = await migrateLegacyLocalStateIfNeeded(remoteState);

  state.selectedMonth = remoteState.preferences?.selected_month || remoteState.transactions[0]?.competence || CURRENT_MONTH;
  state.dashboardCategoryId = remoteState.preferences?.dashboard_category_id || "";
  state.filters = remoteState.preferences?.filters || state.filters;
  state.planning = Object.keys(remoteState.planning).length ? remoteState.planning : structuredClone(EMPTY_PLANNING);
  state.categories = remoteState.categories.length ? remoteState.categories : structuredClone(DEFAULT_CATEGORIES);
  state.transactions = remoteState.transactions;

  clearAuthUrlState();
  showApp();
  resetTransactionForm();
  resetCategoryForm();
  setSyncState("synced", "Tudo sincronizado com sua conta.");
  renderAll();
}

function bindAuthProduction() {
  $("#auth-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = $("#auth-email").value.trim();
    if (!email) return;
    if (!state.isConfigured || !supabaseClient) {
      showAuth({ showSetup: true, message: "Configure o Supabase antes de enviar o link mágico." });
      return;
    }

    $("#auth-submit-button").disabled = true;
    showAuth({ message: "Enviando o link de acesso..." });
    try {
      const redirectTo = CONFIG.authRedirectTo || `${window.location.origin}${window.location.pathname}`;
      const { error } = await supabaseClient.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo },
      });
      if (error) throw error;
      showAuth({ message: "Link enviado. Abra somente o e-mail mais recente para acessar sua conta." });
    } catch (error) {
      const normalizedMessage = String(error.message || "").toLowerCase();
      const message = normalizedMessage.includes("rate limit")
        ? "Você tentou várias vezes em sequência. Aguarde um pouco antes de pedir um novo link."
        : error.message || "Não foi possível enviar o link de acesso.";
      showAuth({ message, showSetup: !state.isConfigured });
    } finally {
      $("#auth-submit-button").disabled = false;
    }
  });

  $("#demo-mode-button").addEventListener("click", () => {
    state.serviceMode = "demo";
    state.isAuthenticated = false;
    state.session = null;
    state.currentUser = null;
    setSyncState("idle", "Dados somente neste navegador.");
    applySnapshot(cacheSnapshot() || legacySnapshot(), true);
    clearAuthUrlState();
    showApp();
    resetTransactionForm();
    resetCategoryForm();
    renderAll();
  });

  $("#sign-out-button").addEventListener("click", async () => {
    if (state.serviceMode === "demo") {
      clearAuthUrlState();
      showAuth({ showSetup: !state.isConfigured });
      return;
    }
    if (!supabaseClient) return;
    await supabaseClient.auth.signOut();
  });
}

function renderAuthMode() {
  const isSignup = state.authMode === "signup";
  $("#auth-mode-signin").classList.toggle("auth-switcher__tab--active", !isSignup);
  $("#auth-mode-signup").classList.toggle("auth-switcher__tab--active", isSignup);
  $("#auth-submit-button").textContent = isSignup ? "Criar conta" : "Entrar";
  $("#auth-description").textContent = isSignup
    ? "Crie sua conta com e-mail e senha para sincronizar seus dados entre dispositivos."
    : "Entre com seu e-mail e senha para acessar seus lançamentos em qualquer dispositivo.";
}

function bindAuthPasswordMode() {
  $("#auth-mode-signin").addEventListener("click", () => {
    state.authMode = "signin";
    renderAuthMode();
    $("#auth-feedback").hidden = true;
  });

  $("#auth-mode-signup").addEventListener("click", () => {
    state.authMode = "signup";
    renderAuthMode();
    $("#auth-feedback").hidden = true;
  });

  $("#auth-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = $("#auth-email").value.trim();
    const password = $("#auth-password").value;
    if (!email || !password) return;
    if (!state.isConfigured || !supabaseClient) {
      showAuth({ showSetup: true, message: "Configure o Supabase antes de usar o login com senha." });
      renderAuthMode();
      return;
    }

    $("#auth-submit-button").disabled = true;
    showAuth({ message: state.authMode === "signup" ? "Criando sua conta..." : "Entrando na sua conta..." });
    renderAuthMode();
    try {
      if (state.authMode === "signup") {
        const { error } = await supabaseClient.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: CONFIG.authRedirectTo || `${window.location.origin}${window.location.pathname}`,
          },
        });
        if (error) throw error;
        showAuth({ message: "Conta criada. Se o Supabase pedir confirmação por e-mail, conclua pelo link recebido." });
        renderAuthMode();
      } else {
        const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (error) {
      const normalizedMessage = String(error.message || "").toLowerCase();
      let message = error.message || "Não foi possível concluir o acesso.";
      if (normalizedMessage.includes("invalid login credentials")) {
        message = "E-mail ou senha inválidos. Revise seus dados e tente novamente.";
      } else if (normalizedMessage.includes("user already registered")) {
        message = "Esse e-mail já está cadastrado. Use a aba Entrar ou redefina sua senha.";
      } else if (normalizedMessage.includes("password")) {
        message = "A senha informada não atende aos critérios exigidos. Tente uma senha mais forte.";
      } else if (normalizedMessage.includes("email not confirmed")) {
        message = "Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.";
      }
      showAuth({ message, showSetup: !state.isConfigured });
      renderAuthMode();
    } finally {
      $("#auth-submit-button").disabled = false;
    }
  });

  $("#auth-reset-button").addEventListener("click", async () => {
    const email = $("#auth-email").value.trim();
    if (!email) {
      showAuth({ message: "Informe seu e-mail para receber a redefinição de senha." });
      renderAuthMode();
      return;
    }
    if (!state.isConfigured || !supabaseClient) {
      showAuth({ showSetup: true, message: "Configure o Supabase antes de usar a recuperação de senha." });
      renderAuthMode();
      return;
    }

    $("#auth-reset-button").disabled = true;
    try {
      const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: CONFIG.authRedirectTo || `${window.location.origin}${window.location.pathname}`,
      });
      if (error) throw error;
      showAuth({ message: "Enviamos um e-mail para redefinir sua senha. Verifique sua caixa de entrada." });
      renderAuthMode();
    } catch (error) {
      showAuth({ message: error.message || "Não foi possível enviar o e-mail de redefinição." });
      renderAuthMode();
    } finally {
      $("#auth-reset-button").disabled = false;
    }
  });

  renderAuthMode();
}

async function bootstrap() {
  bindNav();
  bindPeriodFilter();
  bindAuthPasswordMode();
  bindForms();
  resetTransactionForm();
  resetCategoryForm();

  supabaseClient = createSupabaseClient();
  if (!supabaseClient) {
    state.serviceMode = "remote";
    showAuth({ showSetup: true, message: parseAuthFeedbackFromUrl() });
    return;
  }

  if (!authListenerBound) {
    supabaseClient.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        await bootAuthenticatedApp(session);
      } else {
        state.isAuthenticated = false;
        state.session = null;
        state.currentUser = null;
        setSyncState("idle", "Aguardando autenticação.");
        showAuth({ showSetup: false, message: parseAuthFeedbackFromUrl() });
      }
    });
    authListenerBound = true;
  }

  const { data, error } = await supabaseClient.auth.getSession();
  if (error) {
    showAuth({ message: error.message });
    return;
  }

  if (data.session?.user) {
    await bootAuthenticatedApp(data.session);
    return;
  }

  showAuth({ showSetup: false, message: parseAuthFeedbackFromUrl() });
}

bootstrap().catch((error) => {
  console.error(error);
  showAuth({ message: error.message || "Não foi possível iniciar o Cost Control.", showSetup: !state.isConfigured });
});
