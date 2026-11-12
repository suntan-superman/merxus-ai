(function () {
  var form = document.getElementById('missed-call-calc');
  if (!form) return;
  var money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  var num = function (id) {
    var v = parseFloat(document.getElementById(id).value);
    return isFinite(v) && v > 0 ? v : 0;
  };
  function update() {
    var revenue = num('calc-missed') * (num('calc-qualified') / 100) * (num('calc-convert') / 100) * num('calc-value');
    var contribution = revenue * (num('calc-margin') / 100);
    var cost = num('calc-cost');
    document.getElementById('calc-revenue').textContent = money.format(revenue);
    document.getElementById('calc-contribution').textContent = money.format(contribution);
    var row = document.getElementById('calc-net-row');
    row.hidden = cost === 0;
    if (cost > 0) document.getElementById('calc-net').textContent = money.format(contribution - cost);
  }
  form.addEventListener('input', update);
  update();
})();
