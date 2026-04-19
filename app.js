const navItems = document.querySelectorAll(".nav__item");
const views = document.querySelectorAll(".view");
const viewTitle = document.getElementById("view-title");
const viewEyebrow = document.getElementById("view-eyebrow");

const viewMeta = {
  dashboard: {
    title: "Dashboard",
    eyebrow: "Visão geral financeira",
  },
  planning: {
    title: "Planejamento",
    eyebrow: "Distribuição da renda mensal",
  },
  launches: {
    title: "Lançamentos",
    eyebrow: "Receitas, despesas e recorrências",
  },
  card: {
    title: "Cartão",
    eyebrow: "Ciclo de fatura e parcelas futuras",
  },
  investments: {
    title: "Investimentos",
    eyebrow: "Aportes em renda fixa e ações",
  },
  goals: {
    title: "Metas",
    eyebrow: "Economia geral e objetivo anual",
  },
  categories: {
    title: "Categorias",
    eyebrow: "Gestão modular de classificações",
  },
  reports: {
    title: "Relatórios",
    eyebrow: "Análise por categoria e período",
  },
  history: {
    title: "Histórico",
    eyebrow: "Busca e rastreabilidade das movimentações",
  },
};

function activateView(viewName) {
  navItems.forEach((item) => {
    item.classList.toggle("nav__item--active", item.dataset.view === viewName);
  });

  views.forEach((view) => {
    view.classList.toggle("view--active", view.dataset.viewPanel === viewName);
  });

  viewTitle.textContent = viewMeta[viewName].title;
  viewEyebrow.textContent = viewMeta[viewName].eyebrow;
}

navItems.forEach((item) => {
  item.addEventListener("click", () => activateView(item.dataset.view));
});
