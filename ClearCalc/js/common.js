const DISCLAIMER =
  "ClearCalc is for education only and is not financial, tax, or investment advice. Results are estimates based on the numbers you enter and simplified assumptions (fixed rates, no fees unless noted). Check figures against your lender, employer, or a licensed advisor before making decisions.";

const SECTIONS = [
  { id: "debt", name: "Debt", tab: "Debt calculators" },
  { id: "investing", name: "Investing", tab: "Investing calculators" },
  { id: "everyday", name: "Everyday", tab: "Everyday calculators" },
];

const CALCULATORS = [
  { href: "loan.html", name: "Loan & mortgage", blurb: "Monthly payment, total interest, and a full amortization table.", section: "debt" },
  { href: "extra-payment.html", name: "Extra payment", blurb: "How much faster a loan is paid off with extra principal.", section: "debt" },
  { href: "credit-card.html", name: "Credit card payoff", blurb: "Minimum vs fixed payments, and when a balance never shrinks.", section: "debt" },
  { href: "snowball.html", name: "Snowball vs avalanche", blurb: "Several debts: compare months and interest under two payoff orders.", section: "debt" },
  { href: "compound.html", name: "Compound interest", blurb: "See how a balance grows with regular contributions.", section: "investing" },
  { href: "savings-goal.html", name: "Savings goal", blurb: "Time to target, or the monthly amount a deadline requires.", section: "investing" },
  { href: "retirement.html", name: "401(k) / IRA", blurb: "Salary, contributions, employer match, and the free money you might leave.", section: "investing" },
  { href: "fire.html", name: "FIRE planner", blurb: "FIRE number, years to get there, Coast FIRE, and a 4% withdrawal check.", section: "investing" },
  { href: "rule-of-72.html", name: "Rule of 72", blurb: "Years to double at a given rate, next to the exact compound math.", section: "investing" },
  { href: "emergency.html", name: "Emergency fund", blurb: "3, 6, or 12 months of expenses, and how long the gap takes to fill.", section: "everyday" },
];

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });

function formatMoney(n) {
  if (n == null || !Number.isFinite(n)) return "—";
  return usd.format(n);
}
function formatMonths(total) {
  if (total == null || !Number.isFinite(total)) return total === Infinity ? "Never" : "—";
  const m = Math.max(0, Math.ceil(total));
  const years = Math.floor(m / 12), months = m % 12;
  if (years === 0) return months === 1 ? "1 month" : months + " months";
  if (months === 0) return years === 1 ? "1 year" : years + " years";
  return (years === 1 ? "1 year " : years + " years ") + (months === 1 ? "1 month" : months + " months");
}
function formatDate(d) {
  if (!d || Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}
function formatDateISO(d) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function todayISO() { return formatDateISO(new Date()); }
function parseNum(raw) {
  const trimmed = String(raw ?? "").trim().replace(/,/g, "");
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}
function escapeCsv(v) {
  const s = String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function downloadCsv(filename, headers, rows) {
  const lines = [headers.map(escapeCsv).join(",")].concat(rows.map((r) => r.map(escapeCsv).join(",")));
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.rel = "noopener";
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

function getTheme() {
  try {
    const t = localStorage.getItem("clearcalc-theme");
    if (t === "dark" || t === "light") return t;
  } catch (e) { /* ignore */ }
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
function applyTheme(t) {
  document.documentElement.classList.toggle("dark", t === "dark");
  document.documentElement.style.colorScheme = t;
}
function toggleTheme() {
  const next = document.documentElement.classList.contains("dark") ? "light" : "dark";
  applyTheme(next);
  try { localStorage.setItem("clearcalc-theme", next); } catch (e) { /* ignore */ }
  const btn = document.getElementById("theme-btn");
  if (btn) btn.setAttribute("aria-label", next === "dark" ? "Switch to light theme" : "Switch to dark theme");
}

function persist(key, form) {
  const data = {};
  for (const el of form.elements) {
    if (!el.name) continue;
    if (el.type === "radio") { if (el.checked) data[el.name] = el.value; }
    else if (el.type === "checkbox") data[el.name] = el.checked ? "yes" : "no";
    else data[el.name] = el.value;
  }
  try { localStorage.setItem(key, JSON.stringify(data)); } catch (e) { /* ignore */ }
}
function restore(key, form) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const data = JSON.parse(raw);
    for (const el of form.elements) {
      if (!el.name || data[el.name] == null) continue;
      if (el.type === "radio") el.checked = el.value === data[el.name];
      else if (el.type === "checkbox") el.checked = data[el.name] === "yes";
      else el.value = data[el.name];
    }
  } catch (e) { /* ignore */ }
}

function debounce(fn, ms) {
  let t;
  return function () {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, arguments), ms);
  };
}

function logoSvg() {
  return '<svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="currentColor"/><path d="M8 22V14h3v8H8zm6 0V10h3v12h-3zm6 0V16h3v6h-3z" fill="var(--card)"/></svg>';
}

function mountChrome(active) {
  applyTheme(getTheme());
  const header = document.querySelector(".header-inner");
  const nav = document.createElement("nav");
  nav.className = "nav";
  nav.setAttribute("aria-label", "Primary");
  const home = active === "home" ? " current" : "";
  const activeSection = (CALCULATORS.find((c) => c.href === active) || {}).section;
  nav.innerHTML =
    '<a class="home-link' + home + '" href="index.html">Home</a>' +
    SECTIONS.map((section) => {
      const current = activeSection === section.id ? " current" : "";
      return (
        '<details class="nav-details">' +
        '<summary class="' + current + '" aria-label="' + section.tab + '">' +
        '<span class="tab-row"><span class="tab-short">' + section.name + "</span>" +
        '<span class="tab-long">' + section.tab + "</span>" +
        ' <span aria-hidden="true">▾</span></span></summary>' +
        '<div class="menu">' +
        CALCULATORS.filter((c) => c.section === section.id).map((c) =>
          '<a href="' + c.href + '"' + (active === c.href ? ' class="current"' : "") + ">" +
          c.name + "<small>" + c.blurb + "</small></a>"
        ).join("") +
        "</div></details>"
      );
    }).join("");
  header.appendChild(nav);
  const themeBtn = document.createElement("button");
  themeBtn.type = "button";
  themeBtn.className = "icon-btn";
  themeBtn.id = "theme-btn";
  themeBtn.setAttribute("aria-label", "Toggle theme");
  themeBtn.textContent = "◐";
  header.appendChild(themeBtn);
  document.getElementById("theme-btn").addEventListener("click", toggleTheme);
  const menus = nav.querySelectorAll("details");
  menus.forEach((d) => {
    d.addEventListener("toggle", () => {
      if (!d.open) return;
      menus.forEach((o) => { if (o !== d) o.open = false; });
    });
  });
  document.addEventListener("pointerdown", (e) => {
    if (!nav.contains(e.target)) menus.forEach((d) => { d.open = false; });
  });
  document.querySelector(".footer-inner").innerHTML =
    "<p>" + DISCLAIMER + "</p><p>Do not rely on these estimates for returns, product choices, or borrowing decisions.</p>";
  const form = document.getElementById("form");
  const results = document.getElementById("results");
  if (form && results && !form.querySelector(".jump-results")) {
    const p = document.createElement("p");
    p.className = "jump-results";
    p.innerHTML = '<a href="#results">View results</a>';
    form.appendChild(p);
  }
}

function stat(label, value, large) {
  return '<div class="stat' + (large ? " large" : "") + '"><span>' + label + "</span><strong>" + value + "</strong></div>";
}

function chartColors() {
  const dark = document.documentElement.classList.contains("dark");
  return {
    contrib: dark ? "#7AB596" : "#1B5E45",
    interest: dark ? "#C4B594" : "#8F7E55",
    baseline: dark ? "#8A968E" : "#6A736C",
    extra: dark ? "#7AB596" : "#1B5E45",
    target: dark ? "#E07A7A" : "#8F2D2D",
    tick: dark ? "#9AA79E" : "#5C675F",
    grid: dark ? "rgba(255,255,255,0.08)" : "rgba(26,34,28,0.08)",
  };
}

function destroyChart(holder) {
  if (holder && holder._chart) { holder._chart.destroy(); holder._chart = null; }
}
