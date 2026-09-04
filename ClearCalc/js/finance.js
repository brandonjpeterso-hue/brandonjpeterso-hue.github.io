/* ClearCalc finance helpers — all math runs in the browser. */
const COMPOUND_PERIODS = { daily: 365, monthly: 12, quarterly: 4, annually: 1 };
const FREQUENCY_LABEL = { daily: "Daily", monthly: "Monthly", quarterly: "Quarterly", annually: "Annually" };
const MONEY_EPS = 0.005;
const MAX_MONTHS = 720;

function roundCents(n) {
  return Math.round(n * 100) / 100;
}

function monthlyPiPayment(principal, annualRatePct, years) {
  const n = Math.round(years * 12);
  if (n <= 0 || principal <= 0) return 0;
  const r = annualRatePct / 100 / 12;
  if (r === 0) return roundCents(principal / n);
  const pow = Math.pow(1 + r, n);
  return roundCents((principal * r * pow) / (pow - 1));
}

function addMonthsClamped(date, months) {
  const d = new Date(date.getTime());
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) d.setDate(0);
  return d;
}

function summarizeYears(schedule, start) {
  const map = new Map();
  for (const row of schedule) {
    let key, label;
    if (start && row.date) {
      key = String(row.date.getFullYear());
      label = key;
    } else {
      const y = Math.ceil(row.month / 12);
      key = "y" + y;
      label = "Year " + y;
    }
    let agg = map.get(key);
    if (!agg) {
      agg = { yearLabel: label, payments: 0, principal: 0, interest: 0, extra: 0, endingBalance: row.balance };
      map.set(key, agg);
    }
    agg.payments += row.payment;
    agg.principal += row.principal;
    agg.extra += row.extra;
    agg.interest += row.interest;
    agg.endingBalance = row.balance;
  }
  return [...map.values()].map((y) => ({
    ...y,
    payments: roundCents(y.payments),
    principal: roundCents(y.principal),
    interest: roundCents(y.interest),
    extra: roundCents(y.extra),
    endingBalance: roundCents(y.endingBalance),
  }));
}

function amortize(opts) {
  const principal = opts.principal;
  const nTerm = Math.round(opts.years * 12);
  const basePayment = monthlyPiPayment(principal, opts.annualRatePct, opts.years);
  const r = opts.annualRatePct / 100 / 12;
  const extraMonthly = Math.max(0, opts.extraMonthly ?? 0);
  const oneTime = opts.oneTime && opts.oneTime.month > 0 && opts.oneTime.amount > 0 ? opts.oneTime : null;
  const start = opts.startDate && !Number.isNaN(opts.startDate.getTime()) ? opts.startDate : null;
  const schedule = [];
  let balance = roundCents(principal);
  let month = 0;
  let totalInterest = 0;
  let totalPaid = 0;
  const hardCap = Math.max(nTerm + 12, MAX_MONTHS);

  while (balance > MONEY_EPS && month < hardCap) {
    month += 1;
    const interest = roundCents(balance * r);
    let extraWanted = extraMonthly;
    if (oneTime && oneTime.month === month) extraWanted += oneTime.amount;
    const scheduledPrincipal = Math.min(balance, Math.max(0, roundCents(basePayment - interest)));
    const extraApplied = Math.min(roundCents(balance - scheduledPrincipal), Math.max(0, extraWanted));
    const principalPart = roundCents(scheduledPrincipal + extraApplied);
    const payment = roundCents(principalPart + interest);
    balance = roundCents(balance - principalPart);
    if (balance < MONEY_EPS) balance = 0;
    totalInterest += interest;
    totalPaid += payment;
    schedule.push({
      month,
      date: start ? addMonthsClamped(start, month - 1) : null,
      payment,
      principal: principalPart,
      interest,
      extra: extraApplied,
      balance,
    });
  }

  return {
    monthlyPayment: basePayment,
    schedule,
    yearly: summarizeYears(schedule, start),
    totalPaid: roundCents(totalPaid),
    totalInterest: roundCents(totalInterest),
    totalPrincipal: roundCents(principal - balance),
    months: schedule.length,
    payoffDate: schedule.length ? schedule[schedule.length - 1].date : null,
  };
}

function fvAt(principal, i, k, pmt, timing) {
  if (k <= 0) return principal;
  const growth = i === 0 ? 1 : Math.pow(1 + i, k);
  const lump = principal * growth;
  let annuity;
  if (pmt === 0) annuity = 0;
  else if (i === 0) annuity = pmt * k;
  else annuity = pmt * ((growth - 1) / i);
  if (timing === "beginning" && i !== 0) annuity *= 1 + i;
  return lump + annuity;
}

function compoundInterest(opts) {
  const n = COMPOUND_PERIODS[opts.frequency];
  const i = opts.annualRatePct / 100 / n;
  const N = opts.years * n;
  const pmt = opts.monthlyContribution * (12 / n);
  const valueAt = (k) => fvAt(opts.principal, i, k, pmt, opts.timing);
  const contribAt = (k) => opts.principal + pmt * k;
  const futureValue = roundCents(valueAt(N));
  const totalContributions = roundCents(contribAt(N));
  const totalInterest = roundCents(futureValue - totalContributions);
  const series = [];
  const wholeYears = Math.floor(opts.years);
  for (let y = 0; y <= wholeYears; y++) {
    const value = valueAt(y * n);
    const contributions = contribAt(y * n);
    series.push({ year: y, contributions: roundCents(contributions), value: roundCents(value), interest: roundCents(value - contributions) });
  }
  if (opts.years - wholeYears > 1e-9) {
    const value = valueAt(N);
    const contributions = contribAt(N);
    series.push({ year: roundCents(opts.years), contributions: roundCents(contributions), value: roundCents(value), interest: roundCents(value - contributions) });
  }
  return { futureValue, totalContributions, totalInterest, series };
}

function nextCardPayment(balance, interest, opts) {
  if (opts.mode === "fixed") return roundCents(Math.max(0, opts.fixedPayment));
  return roundCents(Math.max(25, (opts.minPercent / 100) * balance + interest));
}

function creditCardPayoff(opts) {
  const monthlyRate = opts.aprPct / 100 / 12;
  let balance = roundCents(opts.balance);
  let month = 0;
  let totalPaid = 0;
  let totalInterest = 0;
  const series = [{ month: 0, balance, paid: 0 }];
  const firstInterest = roundCents(balance * monthlyRate);
  const firstPayment = nextCardPayment(balance, firstInterest, opts);
  const grows = firstPayment + MONEY_EPS < firstInterest && balance > 0;
  if (grows || firstPayment <= 0) {
    return { months: Infinity, totalPaid: 0, totalInterest: 0, payoff: false, grows: true, monthlyInterestStart: firstInterest, firstPayment, series };
  }
  while (balance > MONEY_EPS && month < MAX_MONTHS) {
    month += 1;
    const interest = roundCents(balance * monthlyRate);
    let payment = nextCardPayment(balance, interest, opts);
    if (payment > balance + interest) payment = roundCents(balance + interest);
    if (payment <= interest && balance > MONEY_EPS) {
      return { months: Infinity, totalPaid: roundCents(totalPaid), totalInterest: roundCents(totalInterest), payoff: false, grows: true, monthlyInterestStart: firstInterest, firstPayment, series };
    }
    const principalPart = roundCents(payment - interest);
    balance = roundCents(balance - principalPart);
    if (balance < MONEY_EPS) balance = 0;
    totalPaid += payment;
    totalInterest += interest;
    if (month <= 24 || month % 3 === 0 || balance === 0) series.push({ month, balance, paid: roundCents(totalPaid) });
  }
  const payoff = balance <= MONEY_EPS;
  return { months: payoff ? month : Infinity, totalPaid: roundCents(totalPaid), totalInterest: roundCents(totalInterest), payoff, grows: !payoff, monthlyInterestStart: firstInterest, firstPayment, series };
}

function fvSavings(pv, i, k, pmt) {
  if (k <= 0) return pv;
  if (i === 0) return pv + pmt * k;
  const g = Math.pow(1 + i, k);
  return pv * g + pmt * ((g - 1) / i);
}

function buildSavingsSeries(pv, i, pmt, target, months) {
  const points = [];
  const cap = Math.max(1, months);
  const step = cap > 120 ? 3 : 1;
  for (let m = 0; m <= cap; m += step) {
    points.push({ month: m, year: roundCents(m / 12), balance: roundCents(fvSavings(pv, i, m, pmt)), target });
  }
  if (points[points.length - 1].month !== cap) {
    points.push({ month: cap, year: roundCents(cap / 12), balance: roundCents(fvSavings(pv, i, cap, pmt)), target });
  }
  return points;
}

function savingsTimeToGoal(opts) {
  const target = opts.target, pv = opts.current, pmt = opts.monthlyContribution, i = opts.annualReturnPct / 100 / 12;
  if (pv >= target) {
    return { months: 0, reachable: true, futureValue: pv, alreadyThere: true, series: [{ month: 0, year: 0, balance: pv, target }] };
  }
  let months;
  if (i === 0) {
    if (pmt <= 0) return { months: Infinity, reachable: false, futureValue: pv, alreadyThere: false, series: [] };
    months = Math.ceil((target - pv) / pmt);
  } else if (pmt === 0) {
    if (pv <= 0) return { months: Infinity, reachable: false, futureValue: pv, alreadyThere: false, series: [] };
    months = Math.ceil(Math.log(target / pv) / Math.log(1 + i));
  } else {
    const num = target + pmt / i, den = pv + pmt / i;
    if (den <= 0 || num / den <= 0) return { months: Infinity, reachable: false, futureValue: pv, alreadyThere: false, series: [] };
    months = Math.ceil(Math.log(num / den) / Math.log(1 + i));
  }
  if (!Number.isFinite(months) || months < 0 || months > MAX_MONTHS) {
    return { months: Infinity, reachable: false, futureValue: pv, alreadyThere: false, series: buildSavingsSeries(pv, i, pmt, target, Math.min(MAX_MONTHS, 240)) };
  }
  return { months, reachable: true, futureValue: roundCents(fvSavings(pv, i, months, pmt)), alreadyThere: false, series: buildSavingsSeries(pv, i, pmt, target, months) };
}

function savingsContributionNeeded(opts) {
  const t = opts.months, i = opts.annualReturnPct / 100 / 12, pv = opts.current, target = opts.target;
  if (t <= 0) return { monthly: 0, alreadyOnTrack: pv >= target, months: 0, series: [] };
  const grown = fvSavings(pv, i, t, 0);
  if (grown >= target) return { monthly: 0, alreadyOnTrack: true, months: t, series: buildSavingsSeries(pv, i, 0, target, t) };
  const pmt = roundCents(Math.max(0, i === 0 ? (target - pv) / t : ((target - grown) * i) / (Math.pow(1 + i, t) - 1)));
  return { monthly: pmt, alreadyOnTrack: false, months: t, series: buildSavingsSeries(pv, i, pmt, target, t) };
}

function parseISODate(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return date;
}

function monthsBetween(fromISO, toISO) {
  const from = parseISODate(fromISO), to = parseISODate(toISO);
  if (!from || !to) return null;
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
}

function pickTarget(accounts, method) {
  const live = accounts.filter((a) => a.balance > MONEY_EPS);
  if (!live.length) return null;
  return live.reduce((best, a) => {
    if (method === "snowball") {
      if (a.balance < best.balance - MONEY_EPS) return a;
      if (Math.abs(a.balance - best.balance) <= MONEY_EPS && a.aprPct > best.aprPct) return a;
      return best;
    }
    if (a.aprPct > best.aprPct + 1e-9) return a;
    if (Math.abs(a.aprPct - best.aprPct) <= 1e-9 && a.balance < best.balance) return a;
    return best;
  });
}

function payoffDebts(debts, extraMonthly, method) {
  const accounts = debts.filter((d) => d.balance > 0).map((d) => ({
    name: (d.name || "").trim() || "Debt",
    balance: roundCents(d.balance),
    aprPct: Math.max(0, d.aprPct),
    minPayment: Math.max(0, d.minPayment),
  }));
  const startBalance = roundCents(accounts.reduce((s, a) => s + a.balance, 0));
  const series = [{ month: 0, balance: startBalance }];
  const events = [];
  let month = 0, totalInterest = 0, totalPaid = 0;
  const extra = Math.max(0, extraMonthly);
  while (accounts.some((a) => a.balance > MONEY_EPS) && month < MAX_MONTHS) {
    month += 1;
    let leftover = extra;
    for (const a of accounts) {
      if (a.balance <= MONEY_EPS) continue;
      const interest = roundCents(a.balance * (a.aprPct / 100 / 12));
      totalInterest += interest;
      a.balance = roundCents(a.balance + interest);
      const pay = Math.min(a.balance, a.minPayment);
      a.balance = roundCents(a.balance - pay);
      totalPaid += pay;
      leftover += roundCents(Math.max(0, a.minPayment - pay));
      if (a.balance <= MONEY_EPS) {
        a.balance = 0;
        events.push({ month, name: a.name });
      }
    }
    leftover = roundCents(leftover);
    while (leftover > MONEY_EPS) {
      const target = pickTarget(accounts, method);
      if (!target) break;
      const pay = Math.min(target.balance, leftover);
      target.balance = roundCents(target.balance - pay);
      leftover = roundCents(leftover - pay);
      totalPaid += pay;
      if (target.balance <= MONEY_EPS) {
        target.balance = 0;
        if (!events.some((e) => e.name === target.name && e.month === month)) events.push({ month, name: target.name });
      }
    }
    const remaining = roundCents(accounts.reduce((s, a) => s + a.balance, 0));
    if (month <= 24 || month % 3 === 0 || remaining === 0) series.push({ month, balance: remaining });
  }
  const payoff = !accounts.some((a) => a.balance > MONEY_EPS);
  if (series[series.length - 1] && series[series.length - 1].month !== month) {
    series.push({ month, balance: roundCents(accounts.reduce((s, a) => s + a.balance, 0)) });
  }
  return {
    months: payoff ? month : Infinity,
    totalInterest: roundCents(totalInterest),
    totalPaid: roundCents(totalPaid),
    payoff,
    order: [...new Set(events.map((e) => e.name))],
    events,
    series,
  };
}

function retirementGrowth(opts) {
  const years = Math.max(0, Math.round(opts.years));
  const i = opts.annualReturnPct / 100 / 12;
  const raise = opts.raisePct / 100;
  const cap = opts.annualCap != null && opts.annualCap > 0 ? opts.annualCap : Infinity;
  let salary = opts.salary, balance = opts.current, employeeTotal = 0, matchTotal = 0;
  const series = [{ year: 0, balance: roundCents(balance), employee: 0, match: 0, growth: 0 }];
  let firstYearEmployee = 0, firstYearMatch = 0, matchLeftOnTable = 0;
  for (let y = 1; y <= years; y++) {
    const uncapped = salary * (Math.max(0, opts.contribPct) / 100);
    const employeeY = roundCents(Math.min(uncapped, cap));
    const effectivePct = salary > 0 ? (employeeY / salary) * 100 : 0;
    const matchY = opts.includeMatch
      ? roundCents(salary * (Math.min(effectivePct, Math.max(0, opts.matchLimitPct)) / 100) * (Math.max(0, opts.matchPercent) / 100))
      : 0;
    const maxMatch = opts.includeMatch
      ? roundCents(salary * (Math.max(0, opts.matchLimitPct) / 100) * (Math.max(0, opts.matchPercent) / 100))
      : 0;
    if (y === 1) {
      firstYearEmployee = employeeY;
      firstYearMatch = matchY;
      matchLeftOnTable = roundCents(Math.max(0, maxMatch - matchY));
    }
    const empM = employeeY / 12, matchM = matchY / 12;
    for (let m = 0; m < 12; m++) balance = i === 0 ? balance + empM + matchM : balance * (1 + i) + empM + matchM;
    employeeTotal += employeeY;
    matchTotal += matchY;
    salary *= 1 + raise;
    series.push({
      year: y,
      balance: roundCents(balance),
      employee: roundCents(employeeTotal),
      match: roundCents(matchTotal),
      growth: roundCents(balance - opts.current - employeeTotal - matchTotal),
    });
  }
  const futureValue = roundCents(balance);
  return {
    futureValue,
    employeeTotal: roundCents(employeeTotal),
    matchTotal: roundCents(matchTotal),
    growth: roundCents(futureValue - opts.current - employeeTotal - matchTotal),
    firstYearEmployee,
    firstYearMatch,
    matchLeftOnTable,
    capped: opts.salary * (opts.contribPct / 100) > cap + MONEY_EPS,
    series,
  };
}

function firePlan(opts) {
  const w = opts.withdrawalPct / 100;
  const fireNumber = w > 0 ? roundCents(opts.annualSpend / w) : Infinity;
  const currentIncome = roundCents(opts.current * w);
  const fireIncome = roundCents(opts.annualSpend);
  const time = Number.isFinite(fireNumber)
    ? savingsTimeToGoal({ target: fireNumber, current: opts.current, annualReturnPct: opts.annualReturnPct, monthlyContribution: opts.monthlyContribution })
    : { months: Infinity, reachable: false, alreadyThere: false };
  const nCoast = Math.max(0, Math.round(opts.yearsToRetire * 12));
  const i = opts.annualReturnPct / 100 / 12;
  let coastNeededNow = fireNumber;
  if (Number.isFinite(fireNumber) && nCoast > 0) coastNeededNow = i === 0 ? fireNumber : roundCents(fireNumber / Math.pow(1 + i, nCoast));
  const coastGap = Number.isFinite(coastNeededNow) ? roundCents(Math.max(0, coastNeededNow - opts.current)) : Infinity;
  const alreadyCoasting = Number.isFinite(coastNeededNow) && opts.current + MONEY_EPS >= coastNeededNow;
  let yearsToCoast = Infinity, coastReachable = false;
  if (Number.isFinite(fireNumber)) {
    if (opts.current + MONEY_EPS >= fireNumber) { yearsToCoast = 0; coastReachable = true; }
    else if (opts.current > 0 && opts.annualReturnPct > 0) {
      const months = Math.ceil(Math.log(fireNumber / opts.current) / Math.log(1 + i));
      if (Number.isFinite(months) && months >= 0 && months <= MAX_MONTHS) { yearsToCoast = months / 12; coastReachable = true; }
      else if (Number.isFinite(months) && months > MAX_MONTHS) yearsToCoast = months / 12;
    } else if (opts.current > 0 && opts.annualReturnPct === 0) {
      yearsToCoast = opts.current + MONEY_EPS >= fireNumber ? 0 : Infinity;
      coastReachable = yearsToCoast === 0;
    }
  }
  const yearsPlot = Math.max(1, Math.min(50, Math.ceil(Math.max(opts.yearsToRetire || 0, time.reachable ? time.months / 12 : 0, coastReachable && Number.isFinite(yearsToCoast) ? yearsToCoast : 0, 10))));
  const series = [];
  for (let y = 0; y <= yearsPlot; y++) {
    const m = y * 12;
    series.push({
      year: y,
      withContrib: roundCents(fvSavings(opts.current, i, m, opts.monthlyContribution)),
      coast: roundCents(fvSavings(opts.current, i, m, 0)),
      fire: Number.isFinite(fireNumber) ? fireNumber : 0,
    });
  }
  return {
    fireNumber: Number.isFinite(fireNumber) ? fireNumber : 0,
    yearsToFire: time.alreadyThere ? 0 : time.months / 12,
    fireReachable: time.reachable,
    alreadyThere: time.alreadyThere,
    currentIncome,
    fireIncome,
    coastNeededNow: Number.isFinite(coastNeededNow) ? coastNeededNow : 0,
    coastGap: Number.isFinite(coastGap) ? coastGap : 0,
    alreadyCoasting,
    yearsToCoast,
    coastReachable,
    series,
  };
}

function ruleOf72Years(ratePct) {
  if (!Number.isFinite(ratePct) || ratePct <= 0 || ratePct > 100) return null;
  return { approx: 72 / ratePct, exact: Math.log(2) / Math.log(1 + ratePct / 100) };
}
function ruleOf72Rate(years) {
  if (!Number.isFinite(years) || years <= 0 || years > 200) return null;
  return { approx: 72 / years, exact: (Math.pow(2, 1 / years) - 1) * 100 };
}
function emergencyFund(opts) {
  const target = roundCents(Math.max(0, opts.monthlyExpenses) * Math.max(0, opts.months));
  const gap = roundCents(Math.max(0, target - Math.max(0, opts.current)));
  if (gap <= MONEY_EPS) return { target, gap: 0, monthsToFill: 0, funded: true, reachable: true };
  if (opts.monthlyContribution <= 0) return { target, gap, monthsToFill: Infinity, funded: false, reachable: false };
  const monthsToFill = Math.ceil(gap / opts.monthlyContribution);
  return { target, gap, monthsToFill, funded: false, reachable: monthsToFill <= MAX_MONTHS };
}

