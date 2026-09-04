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
