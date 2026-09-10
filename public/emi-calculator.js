// public/emi-calculator.js
// Standard reducing-balance EMI formula, entirely client-side — no
// backend call needed, this is pure arithmetic on numbers you already have.

function inr(n) {
  if (n === null || n === undefined || isNaN(n)) return "—";
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

function computeEMI() {
  const principal = Number(document.getElementById("emi_principal").value) || 0;
  const annualRate = Number(document.getElementById("emi_rate").value) || 0;
  const tenureRaw = Number(document.getElementById("emi_tenure").value) || 0;
  const tenureUnit = document.getElementById("emi_tenure_unit").value;

  const months = tenureUnit === "years" ? tenureRaw * 12 : tenureRaw;
  const monthlyRate = annualRate / 12 / 100;

  let emi = 0;
  if (principal > 0 && months > 0) {
    if (monthlyRate === 0) {
      // 0% interest edge case — straight division, no compounding
      emi = principal / months;
    } else {
      const factor = Math.pow(1 + monthlyRate, months);
      emi = (principal * monthlyRate * factor) / (factor - 1);
    }
  }

  const totalPayment = emi * months;
  const totalInterest = totalPayment - principal;

  document.getElementById("emi_result_emi").textContent = inr(emi);
  document.getElementById("emi_result_interest").textContent = inr(totalInterest);
  document.getElementById("emi_result_total").textContent = inr(totalPayment);

  if (totalPayment > 0) {
    const principalPct = (principal / totalPayment) * 100;
    const interestPct = 100 - principalPct;
    document.getElementById("emi_bar_principal").style.width = principalPct + "%";
    document.getElementById("emi_bar_interest").style.width = interestPct + "%";
    document.getElementById("emi_pct_principal").textContent = principalPct.toFixed(1) + "%";
    document.getElementById("emi_pct_interest").textContent = interestPct.toFixed(1) + "%";
  } else {
    document.getElementById("emi_bar_principal").style.width = "0%";
    document.getElementById("emi_bar_interest").style.width = "0%";
    document.getElementById("emi_pct_principal").textContent = "—";
    document.getElementById("emi_pct_interest").textContent = "—";
  }
}

// run once on page load with the default sample values
computeEMI();
