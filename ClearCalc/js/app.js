function bindForm(form, key, onCalc) {
  restore(key, form);
  const run = debounce(() => { persist(key, form); onCalc(); }, 120);
  form.addEventListener("input", run);
  form.addEventListener("change", run);
  onCalc();
}

function pageCompound() {
  const form = document.getElementById("form");
  const results = document.getElementById("results");
  const canvas = document.getElementById("chart");
  bindForm(form, "clearcalc-compound", () => {
    const principal = parseNum(form.principal.value);
    const rate = parseNum(form.rate.value);
    const years = parseNum(form.years.value);
    const contribution = parseNum(form.contribution.value) ?? 0;
    destroyChart(canvas);
    if (principal == null || principal < 0 || rate == null || rate < 0 || rate > 50 || years == null || years <= 0 || years > 80 || contribution < 0) {
      results.innerHTML = '<p class="muted">Enter a non-negative principal, a rate from 0–50%, and years greater than 0.</p>';
      return;
    }
    const r = compoundInterest({ principal, annualRatePct: rate, years, frequency: form.frequency.value, monthlyContribution: contribution, timing: form.timing.value });
    results.innerHTML = '<div class="grid stats stats-3">' +
      stat("Future value", formatMoney(r.futureValue), true) +
      stat("Total contributions", formatMoney(r.totalContributions)) +
      stat("Interest earned", formatMoney(r.totalInterest)) + "</div>";
    const c = chartColors();
    canvas._chart = new Chart(canvas, {
      type: "line",
      data: {
        labels: r.series.map((p) => p.year),
        datasets: [
          { label: "Contributions", data: r.series.map((p) => p.contributions), borderColor: c.contrib, backgroundColor: c.contrib + "59", fill: true, tension: 0.25, pointRadius: 0 },
          { label: "Interest", data: r.series.map((p) => p.interest), borderColor: c.interest, backgroundColor: c.interest + "73", fill: true, tension: 0.25, pointRadius: 0 },
        ],
      },
      options: chartOpts("Year"),
    });
  });
}

function chartOpts(xLabel) {
  const c = chartColors();
  return {
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: { legend: { labels: { color: c.tick } } },
    scales: {
      x: { title: { display: true, text: xLabel, color: c.tick }, ticks: { color: c.tick }, grid: { color: c.grid } },
      y: { stacked: true, ticks: { color: c.tick, callback: (v) => formatMoney(v) }, grid: { color: c.grid } },
    },
  };
}
function lineChartOpts(xLabel) {
  const opts = chartOpts(xLabel);
  opts.scales.y.stacked = false;
  return opts;
}

function pageLoan() {
  const form = document.getElementById("form");
  if (!form.start.value) form.start.value = todayISO();
  const results = document.getElementById("results");
  const extra = document.getElementById("extra");
  let last = null, showAll = false;
  extra.addEventListener("click", (e) => {
    if (e.target.id === "toggle-months" && last) { showAll = !showAll; renderLoanTables(last, showAll); }
    if (e.target.id === "csv" && last) {
      downloadCsv("clearcalc-amortization.csv", ["Month", "Date", "Payment", "Principal", "Interest", "Balance"],
        last.schedule.map((row) => [row.month, row.date ? formatDateISO(row.date) : "", row.payment.toFixed(2), row.principal.toFixed(2), row.interest.toFixed(2), row.balance.toFixed(2)]));
    }
  });
  bindForm(form, "clearcalc-loan", () => {
    const amount = parseNum(form.amount.value), rate = parseNum(form.rate.value), years = parseNum(form.years.value);
    if (amount == null || amount <= 0 || rate == null || rate < 0 || rate > 50 || years == null || years <= 0 || years > 50) {
      last = null; results.innerHTML = '<p class="muted">Enter a loan amount above 0, a rate from 0–50%, and a term greater than 0.</p>'; extra.innerHTML = ""; return;
    }
    last = amortize({ principal: amount, annualRatePct: rate, years, startDate: form.start.value ? parseISODate(form.start.value) : null });
    results.innerHTML = '<div class="grid stats">' +
      stat("Monthly P&I", formatMoney(last.monthlyPayment), true) +
      stat("Total paid", formatMoney(last.totalPaid)) +
      stat("Total interest", formatMoney(last.totalInterest)) +
      stat("Payoff date", last.payoffDate ? formatDate(last.payoffDate) : "Month " + last.months) + "</div>";
    renderLoanTables(last, showAll);
  });
}

function renderLoanTables(result, showAll) {
  const extra = document.getElementById("extra");
  const vis = showAll ? result.schedule : result.schedule.slice(0, 12);
  extra.innerHTML =
    '<section class="table-card"><h3>Year-by-year summary</h3><div class="table-wrap"><table><thead><tr><th>Year</th><th>Paid</th><th>Principal</th><th>Interest</th><th>Balance</th></tr></thead><tbody>' +
    result.yearly.map((y) => "<tr><td>" + y.yearLabel + "</td><td>" + formatMoney(y.payments) + "</td><td>" + formatMoney(y.principal) + "</td><td>" + formatMoney(y.interest) + "</td><td>" + formatMoney(y.endingBalance) + "</td></tr>").join("") +
    '</tbody></table></div></section><section class="table-card"><h3>Monthly schedule</h3><div class="row-actions"><button type="button" class="btn" id="toggle-months">' + (showAll ? "Show first year" : "Show all months") + '</button><button type="button" class="btn" id="csv">Download CSV</button></div><div class="table-wrap"><table><thead><tr><th>Month</th><th>Date</th><th>Payment</th><th>Principal</th><th>Interest</th><th>Balance</th></tr></thead><tbody>' +
    vis.map((row) => "<tr><td>" + row.month + "</td><td>" + (row.date ? formatDate(row.date) : "—") + "</td><td>" + formatMoney(row.payment) + "</td><td>" + formatMoney(row.principal) + "</td><td>" + formatMoney(row.interest) + "</td><td>" + formatMoney(row.balance) + "</td></tr>").join("") +
    "</tbody></table></div></section>";
}

function pageExtra() {
  const form = document.getElementById("form");
  if (!form.start.value) form.start.value = todayISO();
  const results = document.getElementById("results");
  const canvas = document.getElementById("chart");
  bindForm(form, "clearcalc-extra", () => {
    const amount = parseNum(form.amount.value), rate = parseNum(form.rate.value), years = parseNum(form.years.value);
    const extraMonthly = parseNum(form.extraMonthly.value) ?? 0;
    const oneTimeMonth = parseNum(form.oneTimeMonth.value);
    const oneTimeAmount = parseNum(form.oneTimeAmount.value) ?? 0;
    destroyChart(canvas);
    if (amount == null || amount <= 0 || rate == null || rate < 0 || rate > 50 || years == null || years <= 0 || years > 50 || extraMonthly < 0) {
      results.innerHTML = '<p class="muted">Enter a loan amount above 0, a rate from 0–50%, and a term greater than 0.</p>'; return;
    }
    const start = form.start.value ? parseISODate(form.start.value) : null;
    const oneTime = oneTimeMonth && oneTimeMonth >= 1 && oneTimeAmount > 0 ? { month: Math.round(oneTimeMonth), amount: oneTimeAmount } : null;
    const base = amortize({ principal: amount, annualRatePct: rate, years, startDate: start });
    const extra = amortize({ principal: amount, annualRatePct: rate, years, startDate: start, extraMonthly, oneTime });
    results.innerHTML = '<div class="grid stats">' +
      '<div class="card"><h3 class="kicker">Baseline</h3>' + stat("Monthly payment", formatMoney(base.monthlyPayment)) + stat("Months to pay off", formatMonths(base.months)) + stat("Total interest", formatMoney(base.totalInterest)) + "</div>" +
      '<div class="card"><h3 class="kicker">With extra</h3>' + stat("Monthly payment", formatMoney(base.monthlyPayment + extraMonthly)) + stat("Months to pay off", formatMonths(extra.months)) + stat("Total interest", formatMoney(extra.totalInterest)) + "</div>" +
      stat("Interest saved", formatMoney(base.totalInterest - extra.totalInterest), true) +
      stat("Time saved", formatMonths(base.months - extra.months), true) + "</div>";
    const max = Math.max(base.schedule.length, extra.schedule.length);
    const step = max > 240 ? 3 : 1;
    const labels = [], baseLine = [], extraLine = [];
    for (let m = 0; m <= max; m += step) {
      labels.push(m);
      baseLine.push(m === 0 ? amount : m <= base.schedule.length ? base.schedule[m - 1].balance : 0);
      extraLine.push(m === 0 ? amount : m <= extra.schedule.length ? extra.schedule[m - 1].balance : 0);
    }
    const c = chartColors();
    canvas._chart = new Chart(canvas, {
      type: "line",
      data: { labels, datasets: [
        { label: "Baseline", data: baseLine, borderColor: c.baseline, tension: 0.2, pointRadius: 0, fill: false },
        { label: "With extra", data: extraLine, borderColor: c.extra, tension: 0.2, pointRadius: 0, fill: false },
      ]},
      options: Object.assign(chartOpts("Month"), { scales: { x: { ticks: { color: c.tick }, grid: { color: c.grid }, title: { display: true, text: "Month", color: c.tick } }, y: { stacked: false, ticks: { color: c.tick, callback: (v) => formatMoney(v) }, grid: { color: c.grid } } } }),
    });
  });
}

function resultBlock(title, r) {
  return '<div class="card"><h3 class="kicker">' + title + "</h3>" +
    stat("Months to pay off", r.payoff ? formatMonths(r.months) : "Never") +
    stat("Total paid", r.payoff ? formatMoney(r.totalPaid) : "—") +
    stat("Total interest", r.payoff ? formatMoney(r.totalInterest) : "—") + "</div>";
}

function pageCard() {
  const form = document.getElementById("form");
  const results = document.getElementById("results");
  bindForm(form, "clearcalc-card", () => {
    const balance = parseNum(form.balance.value), apr = parseNum(form.apr.value);
    const minPercent = parseNum(form.minPercent.value), fixed = parseNum(form.fixed.value);
    if (balance == null || balance <= 0 || apr == null || apr < 0 || apr > 80 || minPercent == null || minPercent < 1 || minPercent > 3 || (form.mode.value === "fixed" && (fixed == null || fixed < 0))) {
      results.innerHTML = '<p class="muted">Enter a balance above 0 and an APR from 0–80%. For a fixed payment, enter an amount of 0 or more.</p>'; return;
    }
    const primary = creditCardPayoff({ balance, aprPct: apr, mode: form.mode.value, minPercent, fixedPayment: fixed ?? 0 });
    const otherMode = form.mode.value === "fixed" ? "minimum" : "fixed";
    const other = form.compare.checked ? creditCardPayoff({ balance, aprPct: apr, mode: otherMode, minPercent, fixedPayment: fixed ?? 0 }) : null;
    let html = "";
    if (primary.grows) html += '<p class="alert" role="alert">This payment (' + formatMoney(primary.firstPayment) + ") does not cover the first month’s interest (" + formatMoney(primary.monthlyInterestStart) + "). The balance would grow. Raise the payment above the monthly interest to ever pay the card off.</p>";
    html += '<div class="grid stats">' + resultBlock(form.mode.value === "fixed" ? "Fixed payment" : "Minimum payments", primary);
    if (other) html += resultBlock(form.mode.value === "fixed" ? "Minimum payments" : "Fixed payment", other);
    results.innerHTML = html + "</div>";
  });
}

function pageSavings() {
  const form = document.getElementById("form");
  if (!form.deadline.value) {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 5);
    form.deadline.value = formatDateISO(d);
  }
  const results = document.getElementById("results");
  const canvas = document.getElementById("chart");
  const contribField = document.getElementById("contrib-field");
  const dateField = document.getElementById("date-field");
  function syncMode() {
    const time = form.mode.value === "time";
    contribField.hidden = !time; dateField.hidden = time;
  }
  form.addEventListener("change", syncMode);
  syncMode();
  bindForm(form, "clearcalc-savings", () => {
    syncMode();
    const target = parseNum(form.target.value), current = parseNum(form.current.value), rate = parseNum(form.rate.value);
    destroyChart(canvas);
    if (target == null || target <= 0 || current == null || current < 0 || rate == null || rate < 0 || rate > 30) {
      results.innerHTML = '<p class="muted">Enter a target above 0, current savings of 0 or more, and a return from 0–30%.</p>'; return;
    }
    let series = null;
    if (form.mode.value === "time") {
      const contribution = parseNum(form.contribution.value);
      if (contribution == null || contribution < 0) { results.innerHTML = '<p class="muted">Enter a monthly contribution of 0 or more.</p>'; return; }
      const r = savingsTimeToGoal({ target, current, annualReturnPct: rate, monthlyContribution: contribution });
      if (r.alreadyThere) results.innerHTML = stat("Status", "Already there", true);
      else if (r.reachable) results.innerHTML = '<div class="grid stats">' + stat("Time to goal", formatMonths(r.months), true) + stat("Projected balance", formatMoney(r.futureValue)) + "</div>";
      else results.innerHTML = '<p class="alert">With these numbers the target is not reached within 60 years. Increase the contribution, the return, or starting savings — this is a projection, not a promise.</p>';
      series = r.series;
    } else {
      const months = monthsBetween(todayISO(), form.deadline.value);
      if (months == null || months <= 0) { results.innerHTML = '<p class="muted">Choose a target date after today.</p>'; return; }
      const r = savingsContributionNeeded({ target, current, annualReturnPct: rate, months });
      if (r.alreadyOnTrack) results.innerHTML = stat("Monthly contribution needed", formatMoney(0), true);
      else results.innerHTML = '<div class="grid stats">' + stat("Monthly contribution needed", formatMoney(r.monthly), true) + stat("Time until deadline", formatMonths(r.months)) + "</div>";
      series = r.series;
    }
    if (series && series.length > 1) {
      const c = chartColors();
      canvas._chart = new Chart(canvas, {
        type: "line",
        data: { labels: series.map((p) => p.year), datasets: [
          { label: "Balance", data: series.map((p) => p.balance), borderColor: c.contrib, tension: 0.2, pointRadius: 0, fill: false },
          { label: "Target", data: series.map((p) => p.target), borderColor: c.target, borderDash: [6, 4], tension: 0, pointRadius: 0, fill: false },
        ]},
        options: Object.assign(chartOpts("Years"), { scales: { x: { ticks: { color: c.tick }, grid: { color: c.grid }, title: { display: true, text: "Years", color: c.tick } }, y: { stacked: false, ticks: { color: c.tick, callback: (v) => formatMoney(v) }, grid: { color: c.grid } } } }),
      });
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.dataset.page;
  mountChrome(page === "home" ? "home" : page);
  if (page === "home") pageHome();
  if (page === "compound.html") pageCompound();
  if (page === "loan.html") pageLoan();
  if (page === "extra-payment.html") pageExtra();
  if (page === "credit-card.html") pageCard();
  if (page === "savings-goal.html") pageSavings();
  if (page === "snowball.html") pageSnowball();
  if (page === "retirement.html") pageRetirement();
  if (page === "fire.html") pageFire();
  if (page === "emergency.html") pageEmergency();
  if (page === "rule-of-72.html") pageRule72();
});

function pageHome() {
  const host = document.getElementById("home-sections");
  if (!host) return;
  const blurbs = {
    debt: "What a balance costs, and how extra payments change the timeline.",
    investing: "Compounding, retirement accounts, and a simple independence number.",
    everyday: "Cash buffers and a quick doubling rule.",
  };
  host.innerHTML = SECTIONS.map((section) =>
    '<section class="section-block" aria-labelledby="' + section.id + '-heading">' +
    "<h2 id=\"" + section.id + "-heading\">" + section.name + "</h2>" +
    '<p class="lede">' + blurbs[section.id] + "</p>" +
    '<ul class="grid cards" style="list-style:none;padding:0;margin:0">' +
    CALCULATORS.filter((c) => c.section === section.id).map((c) =>
      '<li><a class="card" href="' + c.href + '"><h3>' + c.name + "</h3><p>" + c.blurb + '</p><span class="go">Open calculator →</span></a></li>'
    ).join("") +
    "</ul></section>"
  ).join("");
}

function pageSnowball() {
  const form = document.getElementById("form");
  const list = document.getElementById("debt-list");
  const results = document.getElementById("results");
  const canvas = document.getElementById("chart");
  let debts = [
    { name: "Card A", balance: "4500", apr: "22.99", min: "120" },
    { name: "Card B", balance: "2200", apr: "18.5", min: "55" },
    { name: "Auto", balance: "12000", apr: "7.9", min: "280" },
  ];
  try {
    const raw = localStorage.getItem("clearcalc-snowball");
    if (raw) {
      const data = JSON.parse(raw);
      if (Array.isArray(data.debts) && data.debts.length) debts = data.debts;
      if (data.extra != null) form.extra.value = data.extra;
    }
  } catch (e) { /* ignore */ }

  function esc(s) {
    return String(s)
      .replace(/&/g, "&" + "amp;")
      .replace(/</g, "&" + "lt;")
      .replace(/"/g, "&" + "quot;");
  }
  function renderDebts() {
    list.innerHTML = debts.map((d, i) =>
      '<div class="debt-card" data-i="' + i + '"><div class="debt-head"><span>Debt ' + (i + 1) + "</span>" +
      (debts.length > 1 ? '<button type="button" class="btn remove-debt" data-i="' + i + '">Remove</button>' : "") +
      "</div>" +
      '<div class="field"><label>Name</label><input data-k="name" data-i="' + i + '" value="' + esc(d.name) + '" /></div>' +
      '<div class="field"><label>Balance</label><input inputmode="decimal" data-k="balance" data-i="' + i + '" value="' + esc(d.balance) + '" /></div>' +
      '<div class="field"><label>APR (%)</label><input inputmode="decimal" data-k="apr" data-i="' + i + '" value="' + esc(d.apr) + '" /></div>' +
      '<div class="field"><label>Minimum payment</label><input inputmode="decimal" data-k="min" data-i="' + i + '" value="' + esc(d.min) + '" /></div></div>'
    ).join("");
  }

  function persist() {
    try { localStorage.setItem("clearcalc-snowball", JSON.stringify({ extra: form.extra.value, debts })); } catch (e) { /* ignore */ }
  }

  function calc() {
    persist();
    destroyChart(canvas);
    const extra = parseNum(form.extra.value) ?? 0;
    if (extra < 0) { results.innerHTML = '<p class="muted">Extra payment cannot be negative.</p>'; return; }
    const parsed = [];
    for (const d of debts) {
      const balance = parseNum(d.balance), apr = parseNum(d.apr), min = parseNum(d.min);
      if (balance == null || balance <= 0) continue;
      if (apr == null || apr < 0 || apr > 80 || min == null || min < 0) {
        results.innerHTML = '<p class="muted">Each debt needs a balance above 0, an APR from 0–80%, and a minimum of 0 or more.</p>';
        return;
      }
      parsed.push({ name: (d.name || "").trim() || ("Debt " + (parsed.length + 1)), balance, aprPct: apr, minPayment: min });
    }
    if (!parsed.length) { results.innerHTML = '<p class="muted">Enter at least one debt with a balance above 0.</p>'; return; }
    const snowball = payoffDebts(parsed, extra, "snowball");
    const avalanche = payoffDebts(parsed, extra, "avalanche");
    const warn = (!snowball.payoff || !avalanche.payoff)
      ? '<p class="alert">At least one plan never finishes in 60 years. Raise minimums or the extra payment so they cover interest.</p>'
      : "";
    function block(title, r) {
      return '<div class="card"><h3 class="kicker">' + title + "</h3>" +
        stat("Months to pay off", r.payoff ? formatMonths(r.months) : "Never") +
        stat("Total interest", r.payoff ? formatMoney(r.totalInterest) : "—") +
        stat("Total paid", r.payoff ? formatMoney(r.totalPaid) : "—") +
        (r.order.length ? '<p class="muted">Payoff order: ' + r.order.join(" → ") + "</p>" : "") +
        "</div>";
    }
    const saved = snowball.payoff && avalanche.payoff ? snowball.totalInterest - avalanche.totalInterest : null;
    const timeDiff = snowball.payoff && avalanche.payoff ? Math.abs(snowball.months - avalanche.months) : null;
    const timeHint = !snowball.payoff || !avalanche.payoff ? ""
      : snowball.months === avalanche.months ? "Same payoff month in this example."
      : avalanche.months < snowball.months ? "Avalanche finishes sooner." : "Snowball finishes sooner.";
    results.innerHTML = warn + '<div class="compare-grid">' + block("Snowball (smallest first)", snowball) + block("Avalanche (highest APR first)", avalanche) + "</div>" +
      '<div class="grid stats">' +
      stat("Interest avalanche saves vs snowball", saved == null ? "—" : formatMoney(saved)) +
      stat("Time difference", timeDiff == null ? "—" : formatMonths(timeDiff)) + "</div>" +
      (timeHint ? '<p class="muted">' + timeHint + "</p>" : "");
    const byMonth = new Map();
    snowball.series.forEach((p) => byMonth.set(p.month, { m: p.month, s: p.balance, a: 0 }));
    avalanche.series.forEach((p) => {
      const row = byMonth.get(p.month);
      if (row) row.a = p.balance; else byMonth.set(p.month, { m: p.month, s: 0, a: p.balance });
    });
    const rows = [...byMonth.values()].sort((x, y) => x.m - y.m);
    const c = chartColors();
    canvas._chart = new Chart(canvas, {
      type: "line",
      data: {
        labels: rows.map((r) => r.m),
        datasets: [
          { label: "Snowball", data: rows.map((r) => r.s), borderColor: c.baseline, tension: 0.2, pointRadius: 0, fill: false },
          { label: "Avalanche", data: rows.map((r) => r.a), borderColor: c.extra, tension: 0.2, pointRadius: 0, fill: false },
        ],
      },
      options: lineChartOpts("Month"),
    });
  }

  const run = debounce(calc, 120);
  renderDebts();
  list.addEventListener("input", (e) => {
    const t = e.target;
    if (!t.dataset.k) return;
    const i = Number(t.dataset.i);
    debts[i][t.dataset.k] = t.value;
    run();
  });
  list.addEventListener("click", (e) => {
    const btn = e.target.closest(".remove-debt");
    if (!btn) return;
    debts.splice(Number(btn.dataset.i), 1);
    renderDebts();
    run();
  });
  document.getElementById("add-debt").addEventListener("click", () => {
    if (debts.length >= 8) return;
    debts.push({ name: "", balance: "", apr: "", min: "" });
    renderDebts();
  });
  form.extra.addEventListener("input", run);
  calc();
}

function pageRetirement() {
  const form = document.getElementById("form");
  const results = document.getElementById("results");
  const canvas = document.getElementById("chart");
  const matchFields = document.getElementById("match-fields");
  function syncPlan() {
    const ira = form.plan.value === "ira";
    matchFields.hidden = ira;
    if (ira && form.cap.value === "24500") form.cap.value = "7500";
    if (!ira && form.cap.value === "7500") form.cap.value = "24500";
  }
  bindForm(form, "clearcalc-retirement", () => {
    syncPlan();
    const ira = form.plan.value === "ira";
    const salary = parseNum(form.salary.value), contribPct = parseNum(form.contribPct.value);
    const matchPercent = parseNum(form.matchPercent.value) ?? 0;
    const matchLimitPct = parseNum(form.matchLimitPct.value) ?? 0;
    const current = parseNum(form.current.value) ?? 0;
    const rate = parseNum(form.rate.value), years = parseNum(form.years.value);
    const raisePct = parseNum(form.raisePct.value) ?? 0;
    const cap = parseNum(form.cap.value);
    destroyChart(canvas);
    if (salary == null || salary <= 0 || contribPct == null || contribPct < 0 || contribPct > 100 || rate == null || rate < 0 || rate > 50 || years == null || years <= 0 || years > 50 || current < 0 || raisePct < 0) {
      results.innerHTML = '<p class="muted">Enter a salary above 0, a contribution from 0–100%, a return from 0–50%, and years greater than 0.</p>';
      return;
    }
    const r = retirementGrowth({
      salary, contribPct, matchPercent: ira ? 0 : matchPercent, matchLimitPct: ira ? 0 : matchLimitPct,
      includeMatch: !ira, current, annualReturnPct: rate, years, raisePct, annualCap: cap != null && cap > 0 ? cap : null,
    });
    let html = "";
    if (r.matchLeftOnTable > 0) html += '<p class="alert">Raising your contribution to the match limit would add about ' + formatMoney(r.matchLeftOnTable) + ' of employer money this year.</p>';
    if (r.capped) html += '<p class="muted">Your chosen percent hits the annual employee cap. Catch-up amounts for age 50+ are not added.</p>';
    html += stat("Future value", formatMoney(r.futureValue), true) +
      '<div class="grid stats">' +
      stat("You contribute", formatMoney(r.employeeTotal)) +
      stat(ira ? "Employer match" : "Employer match (free money)", formatMoney(r.matchTotal)) +
      stat("Growth", formatMoney(r.growth)) + "</div>";
    if (!ira) html += '<div class="grid stats">' + stat("Your contribution this year", formatMoney(r.firstYearEmployee)) + stat("Match this year", formatMoney(r.firstYearMatch)) + "</div>";
    results.innerHTML = html;
    const c = chartColors();
    canvas._chart = new Chart(canvas, {
      type: "line",
      data: {
        labels: r.series.map((p) => p.year),
        datasets: [
          { label: "Balance", data: r.series.map((p) => p.balance), borderColor: c.extra, tension: 0.2, pointRadius: 0, fill: false },
          { label: "Your contributions", data: r.series.map((p) => p.employee), borderColor: c.contrib, tension: 0.2, pointRadius: 0, fill: false },
          { label: "Employer match", data: r.series.map((p) => p.match), borderColor: c.interest, tension: 0.2, pointRadius: 0, fill: false },
        ],
      },
      options: lineChartOpts("Year"),
    });
  });
  form.addEventListener("change", () => { if (form.plan) syncPlan(); });
  syncPlan();
}

function pageFire() {
  const form = document.getElementById("form");
  const results = document.getElementById("results");
  const canvas = document.getElementById("chart");
  bindForm(form, "clearcalc-fire", () => {
    const spend = parseNum(form.spend.value), withdrawal = parseNum(form.withdrawal.value);
    const current = parseNum(form.current.value) ?? 0, contribution = parseNum(form.contribution.value) ?? 0;
    const rate = parseNum(form.rate.value), yearsToRetire = parseNum(form.yearsToRetire.value);
    destroyChart(canvas);
    if (spend == null || spend <= 0 || withdrawal == null || withdrawal <= 0 || withdrawal > 20 || rate == null || rate < 0 || rate > 50 || current < 0 || contribution < 0 || yearsToRetire == null || yearsToRetire < 0 || yearsToRetire > 60) {
      results.innerHTML = '<p class="muted">Enter spending above 0, a withdrawal rate from 0–20% (not including 0), a return from 0–50%, and years until you want to stop contributing.</p>';
      return;
    }
    const r = firePlan({ annualSpend: spend, withdrawalPct: withdrawal, current, monthlyContribution: contribution, annualReturnPct: rate, yearsToRetire });
    results.innerHTML = stat("FIRE number", formatMoney(r.fireNumber), true) +
      '<p class="muted">' + formatMoney(r.fireIncome) + " per year at your withdrawal rate.</p>" +
      '<div class="grid stats">' +
      stat("Years to FIRE (with contributions)", r.alreadyThere ? "Already there" : r.fireReachable ? formatMonths(r.yearsToFire * 12) : "Beyond 60 years") +
      stat("Safe withdrawal from current nest egg", formatMoney(r.currentIncome)) + "</div>" +
      '<div class="card"><h3 class="kicker">Coast FIRE</h3>' +
      '<div class="grid stats">' +
      stat("Nest egg needed today to coast", formatMoney(r.coastNeededNow)) +
      stat(r.alreadyCoasting ? "Already coasting by" : "Gap to coast", formatMoney(r.alreadyCoasting ? r.coastNeededNow : r.coastGap)) +
      stat("Years for current nest egg to reach FIRE with $0 more added", r.alreadyThere ? "0" : r.coastReachable ? formatMonths(r.yearsToCoast * 12) : "Never at this return") +
      "</div></div>";
    const c = chartColors();
    canvas._chart = new Chart(canvas, {
      type: "line",
      data: {
        labels: r.series.map((p) => p.year),
        datasets: [
          { label: "With contributions", data: r.series.map((p) => p.withContrib), borderColor: c.extra, tension: 0.2, pointRadius: 0, fill: false },
          { label: "Coast (no new money)", data: r.series.map((p) => p.coast), borderColor: c.baseline, tension: 0.2, pointRadius: 0, fill: false },
          { label: "FIRE number", data: r.series.map((p) => p.fire), borderColor: c.target, borderDash: [6, 4], tension: 0, pointRadius: 0, fill: false },
        ],
      },
      options: lineChartOpts("Year"),
    });
  });
}

function pageEmergency() {
  const form = document.getElementById("form");
  const results = document.getElementById("results");
  const customWrap = document.getElementById("custom-months");
  bindForm(form, "clearcalc-emergency", () => {
    customWrap.hidden = form.months.value !== "custom";
    const expenses = parseNum(form.expenses.value);
    const months = form.months.value === "custom" ? parseNum(form.customMonths.value) : parseNum(form.months.value);
    const current = parseNum(form.current.value) ?? 0, contribution = parseNum(form.contribution.value) ?? 0;
    if (expenses == null || expenses <= 0 || months == null || months <= 0 || months > 36 || current < 0 || contribution < 0) {
      results.innerHTML = '<p class="muted">Enter monthly expenses above 0 and a target between 1 and 36 months.</p>';
      return;
    }
    const r = emergencyFund({ monthlyExpenses: expenses, months, current, monthlyContribution: contribution });
    results.innerHTML = stat("Target cash", formatMoney(r.target), true) +
      '<div class="grid stats">' +
      stat("Gap", r.funded ? "Funded" : formatMoney(r.gap)) +
      stat("Months to fill", r.funded ? "0" : r.reachable ? formatMonths(r.monthsToFill) : "Add a monthly amount") +
      "</div>";
  });
}

function pageRule72() {
  const form = document.getElementById("form");
  const results = document.getElementById("results");
  bindForm(form, "clearcalc-rule72", () => {
    document.getElementById("rate-field").hidden = form.mode.value !== "years";
    document.getElementById("years-field").hidden = form.mode.value !== "rate";
    if (form.mode.value === "years") {
      const r = ruleOf72Years(parseNum(form.rate.value));
      if (!r) { results.innerHTML = '<p class="muted">Enter a rate from 0–100% (not including 0).</p>'; return; }
      results.innerHTML = '<div class="grid stats">' + stat("Rule of 72", r.approx.toFixed(1) + " years", true) + stat("Exact compound time", r.exact.toFixed(1) + " years") + "</div>";
    } else {
      const r = ruleOf72Rate(parseNum(form.years.value));
      if (!r) { results.innerHTML = '<p class="muted">Enter years greater than 0.</p>'; return; }
      results.innerHTML = '<div class="grid stats">' + stat("Rule of 72 rate", r.approx.toFixed(2) + "%", true) + stat("Exact rate", r.exact.toFixed(2) + "%") + "</div>";
    }
  });
}

