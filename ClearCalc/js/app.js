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
  if (page === "compound.html") pageCompound();
  if (page === "loan.html") pageLoan();
  if (page === "extra-payment.html") pageExtra();
  if (page === "credit-card.html") pageCard();
  if (page === "savings-goal.html") pageSavings();
});
