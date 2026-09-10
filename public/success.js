(function () {
  "use strict";

  var MAX_ATTEMPTS = 6;
  var RETRY_DELAY_MS = 1500;

  var params = new URLSearchParams(window.location.search);
  var ticketId = params.get("ticketId");

  var stateChecking = document.getElementById("state-checking");
  var statePaid = document.getElementById("state-paid");
  var statePending = document.getElementById("state-pending");
  var stateError = document.getElementById("state-error");
  var retryButton = document.getElementById("retry-button");

  function showOnly(el) {
    [stateChecking, statePaid, statePending, stateError].forEach(function (node) {
      node.hidden = node !== el;
    });
  }

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

  function formatHours(hours) {
    if (hours === 24) return "Todo el día";
    if (hours < 1) return Math.round(hours * 60) + " minutos";
    if (hours === 1) return "1 hora";
    return hours + " horas";
  }

  function formatDate(iso) {
    try {
      return new Intl.DateTimeFormat("es-DO", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(iso));
    } catch (e) {
      return iso;
    }
  }

  function renderPaid(ticket) {
    document.getElementById("detail-id").textContent = ticket.id;
    document.getElementById("detail-hours").textContent = formatHours(ticket.hoursRequested);
    document.getElementById("detail-plate").textContent = ticket.plate || "No indicada";
    document.getElementById("detail-amount").textContent = formatMoney(ticket.amountCents, ticket.currency);
    document.getElementById("detail-paid-at").textContent = ticket.paidAt ? formatDate(ticket.paidAt) : "—";
    showOnly(statePaid);
  }

  function renderPending(ticket) {
    document.getElementById("detail-id-pending").textContent = ticket.id;
    showOnly(statePending);
  }

  async function fetchTicket() {
    var response = await fetch("/api/tickets/" + encodeURIComponent(ticketId));
    if (!response.ok) {
      throw new Error("NOT_FOUND");
    }
    return response.json();
  }

  async function pollTicket(attempt) {
    try {
      var ticket = await fetchTicket();
      if (ticket.status === "PAID") {
        renderPaid(ticket);
        return;
      }
      if (attempt >= MAX_ATTEMPTS) {
        renderPending(ticket);
        return;
      }
      setTimeout(function () {
        pollTicket(attempt + 1);
      }, RETRY_DELAY_MS);
    } catch (err) {
      showOnly(stateError);
    }
  }

  retryButton.addEventListener("click", function () {
    showOnly(stateChecking);
    pollTicket(0);
  });

  if (!ticketId) {
    showOnly(stateError);
  } else {
    pollTicket(0);
  }
})();
