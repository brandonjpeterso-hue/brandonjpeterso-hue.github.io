# ClearCalc

Educational calculators for compounding, loan cost, and savings timelines. All math runs in the browser. ClearCalc is **not** financial, tax, or investment advice.

Live site (GitHub Pages): https://brandonjpeterso-hue.github.io/ClearCalc/

## Calculators

1. **Compound interest** — future value of a lump sum plus monthly contributions, with daily / monthly / quarterly / annual compounding.
2. **Loan & mortgage** — monthly principal-and-interest payment, total interest, payoff date, yearly summary, full monthly table, CSV export.
3. **Extra payment** — side-by-side baseline vs extra monthly (and optional one-time) principal, with interest and months saved.
4. **Credit card payoff** — minimum-payment rule or a fixed payment; warns if the payment does not cover interest.
5. **Savings goal** — months to a target given contributions, or the monthly amount a deadline requires.

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
