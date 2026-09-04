# ClearCalc

Educational calculators for compounding, loan cost, and savings timelines. All math runs in the browser. ClearCalc is **not** financial, tax, or investment advice.

Live site (GitHub Pages): https://brandonjpeterso-hue.github.io/ClearCalc/

## Calculators

### Debt
1. **Loan & mortgage** — monthly principal-and-interest payment, total interest, payoff date, yearly summary, full monthly table, CSV export.
2. **Extra payment** — side-by-side baseline vs extra monthly (and optional one-time) principal, with interest and months saved.
3. **Credit card payoff** — minimum-payment rule or a fixed payment; warns if the payment does not cover interest.
4. **Snowball vs avalanche** — several debts; compare months and interest under two payoff orders.

### Investing
5. **Compound interest** — future value of a lump sum plus monthly contributions, with daily / monthly / quarterly / annual compounding.
6. **Savings goal** — months to a target given contributions, or the monthly amount a deadline requires.
7. **401(k) / IRA** — salary deferrals, optional employer match, and growth.
8. **FIRE planner** — FIRE number, years to get there, Coast FIRE, and a withdrawal-rate income check.
9. **Rule of 72** — years to double at a given rate, next to the exact compound figure.

### Everyday
10. **Emergency fund** — 3 / 6 / 12 months of expenses and months to fill the gap.

## Run locally

This is a static site (HTML, CSS, and vanilla JavaScript). No build step.

- Open `index.html` in a browser, or
- From this folder: `python3 -m http.server 8080` and visit http://localhost:8080/

Chart.js is loaded from a CDN. Everything else is local.

## GitHub Pages

The live site is **https://brandonjpeterso-hue.github.io/ClearCalc/**.

It is published as a folder on the user site (`brandonjpeterso-hue.github.io/ClearCalc/`). The repo root at `https://brandonjpeterso-hue.github.io/` redirects there.

## Disclaimer

ClearCalc is for education only and is not financial, tax, or investment advice. Results are estimates based on the numbers you enter and simplified assumptions (fixed rates, no fees unless noted). Check figures against your lender, employer, or a licensed advisor before making decisions.
