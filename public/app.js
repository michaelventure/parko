(function () {
  "use strict";

  // Opciones de tiempo mostradas al usuario. El PRECIO real y definitivo
  // siempre lo calcula el servidor al crear el ticket (POST /api/tickets);
  // este calculo en el navegador es solo una vista previa para que la
  // persona sepa cuanto va a pagar antes de continuar.
  var HOUR_OPTIONS = [0.5, 1, 2, 3, 4, 6, 8, 24];

  var tenantMeta = document.querySelector('meta[name="parko-tenant"]');
  var TENANT_SLUG = tenantMeta ? tenantMeta.content : "";

  var presetGrid = document.getElementById("preset-grid");
  var summaryAmount = document.getElementById("summary-amount");
  var payButton = document.getElementById("pay-button");
  var form = document.getElementById("ticket-form");
  var plateInput = document.getElementById("plate");
  var formError = document.getElementById("form-error");
  var loadError = document.getElementById("load-error");

  var tariff = null;
  var selectedHours = null;

  function formatMoney(cents, currency) {
    try {
      return new Intl.NumberFormat("es-DO", {
        style: "currency",
        currency: (currency || "usd").toUpperCase(),
      }).format(cents / 100);
    } catch (e) {
      return "$" + (cents / 100).toFixed(2);
    }
  }

  function hourLabel(hours) {
    if (hours === 24) return "Todo el día";
    if (hours < 1) return Math.round(hours * 60) + " minutos";
    if (hours === 1) return "1 hora";
    return hours + " horas";
  }

  // Replica la formula del servidor (src/services/pricing.ts) solo para
  // mostrar un estimado inmediato; el monto que realmente se cobra se
  // vuelve a calcular en el servidor al crear el ticket.
  function estimateAmountCents(hours) {
    var raw = Math.ceil(tariff.ratePerHourCents * hours);
    return Math.min(raw, tariff.dailyMaxCents);
  }

  function showLoadError(message) {
    loadError.textContent = message;
    loadError.hidden = false;
    form.hidden = true;
  }

  function showFormError(message) {
    formError.textContent = message;
    formError.hidden = false;
  }

  function clearFormError() {
    formError.hidden = true;
    formError.textContent = "";
  }

  function renderPresets() {
    presetGrid.innerHTML = "";
    HOUR_OPTIONS.forEach(function (hours) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "preset-btn";
      btn.setAttribute("aria-pressed", "false");
      btn.dataset.hours = String(hours);

      var hoursEl = document.createElement("span");
      hoursEl.className = "preset-hours";
      hoursEl.textContent = hourLabel(hours);

      var priceEl = document.createElement("span");
      priceEl.className = "preset-price";
      priceEl.textContent = formatMoney(estimateAmountCents(hours), tariff.currency);

      btn.appendChild(hoursEl);
      btn.appendChild(priceEl);
      btn.addEventListener("click", function () {
        selectHours(hours, btn);
      });

      presetGrid.appendChild(btn);
    });
  }

  function selectHours(hours, btnEl) {
    selectedHours = hours;
    var buttons = presetGrid.querySelectorAll(".preset-btn");
    buttons.forEach(function (b) {
      b.setAttribute("aria-pressed", b === btnEl ? "true" : "false");
    });
    summaryAmount.textContent =
      hourLabel(hours) + " — " + formatMoney(estimateAmountCents(hours), tariff.currency);
    payButton.disabled = false;
    clearFormError();
  }

  async function loadTariff() {
    var response = await fetch("/api/tariffs/active?tenantSlug=" + encodeURIComponent(TENANT_SLUG));
    if (!response.ok) {
      throw new Error("NO_TARIFF");
    }
    return response.json();
  }

  async function createTicket(hours, plate) {
    var body = { tenantSlug: TENANT_SLUG, hours: hours };
    if (plate) body.plate = plate;

    var response = await fetch("/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    var data = await response.json();
    if (!response.ok) {
      throw new Error(data && data.error && data.error.message ? data.error.message : "No se pudo crear el ticket");
    }
    return data;
  }

  async function createCheckoutSession(ticketId) {
    var response = await fetch("/api/tickets/" + ticketId + "/checkout-session", {
      method: "POST",
    });
    var data = await response.json();
    if (!response.ok) {
      throw new Error(data && data.error && data.error.message ? data.error.message : "No se pudo iniciar el pago");
    }
    return data;
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    clearFormError();

    if (!selectedHours) {
      showFormError("Primero elige cuántas horas vas a parquear.");
      return;
    }

    payButton.disabled = true;
    payButton.setAttribute("aria-busy", "true");
    var originalLabel = payButton.textContent;
    payButton.textContent = "Conectando con el pago seguro…";

    try {
      var plate = plateInput.value.trim();
      var ticket = await createTicket(selectedHours, plate);
      var session = await createCheckoutSession(ticket.id);
      window.location.href = session.checkoutUrl;
    } catch (err) {
      showFormError(err.message || "Ocurrió un problema. Intenta de nuevo.");
      payButton.disabled = false;
      payButton.removeAttribute("aria-busy");
      payButton.textContent = originalLabel;
    }
  });

  (async function init() {
    try {
      tariff = await loadTariff();
      renderPresets();
    } catch (err) {
      showLoadError(
        "El servicio no está disponible en este momento. Por favor intenta de nuevo en unos minutos."
      );
    }
  })();
})();
