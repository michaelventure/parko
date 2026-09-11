(function () {
  "use strict";

  var tenantMeta = document.querySelector('meta[name="parko-tenant"]');
  var TENANT_SLUG = tenantMeta ? tenantMeta.content : "";

  var toggleBtn = document.getElementById("chat-toggle");
  var panel = document.getElementById("chat-panel");
  var closeBtn = document.getElementById("chat-close");
  var messagesEl = document.getElementById("chat-messages");
  var form = document.getElementById("chat-form");
  var input = document.getElementById("chat-input");
  var sendBtn = form.querySelector(".chat-send");

  // Historial en memoria del navegador — el backend no guarda sesiones de
  // chat, el cliente reenvia el historial completo en cada mensaje.
  var history = [];
  var sending = false;

  // Token de sesion de chat (GET /api/chat/session) — dura poco, se pide
  // de nuevo cuando falta o expiro. Sin esto, POST /api/chat responde 401.
  var sessionToken = null;
  var sessionExpiresAt = 0;

  async function getSessionToken(forceRefresh) {
    if (!forceRefresh && sessionToken && Date.now() < sessionExpiresAt) {
      return sessionToken;
    }
    var res = await fetch("/api/chat/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantSlug: TENANT_SLUG }),
    });
    if (!res.ok) {
      throw new Error("No se pudo iniciar el chat");
    }
    var data = await res.json();
    sessionToken = data.token;
    // Se refresca un poco antes de que expire de verdad.
    sessionExpiresAt = Date.now() + Math.max(data.expiresIn - 15, 5) * 1000;
    return sessionToken;
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // Convierte URLs en links clicables (ej. el link de pago de Stripe).
  // Siempre se aplica sobre texto YA escapado, nunca al reves.
  function linkify(escapedText) {
    return escapedText.replace(/(https?:\/\/[^\s<]+)/g, function (url) {
      return '<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + url + "</a>";
    });
  }

  function addMessage(role, text) {
    var el = document.createElement("div");
    el.className = "chat-msg chat-msg-" + role;
    if (role === "user") {
      el.textContent = text;
    } else {
      el.innerHTML = linkify(escapeHtml(text));
    }
    messagesEl.appendChild(el);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return el;
  }

  function openChat() {
    panel.hidden = false;
    toggleBtn.setAttribute("aria-expanded", "true");
    if (messagesEl.children.length === 0) {
      addMessage("assistant", "¡Hola! Puedo ayudarte con tarifas, disponibilidad o tu ticket de parqueo. ¿En qué te ayudo?");
    }
    input.focus();
  }

  function closeChat() {
    panel.hidden = true;
    toggleBtn.setAttribute("aria-expanded", "false");
    toggleBtn.focus();
  }

  toggleBtn.addEventListener("click", openChat);
  closeBtn.addEventListener("click", closeChat);
  panel.addEventListener("keydown", function (event) {
    if (event.key === "Escape") closeChat();
  });

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (sending) return;

    var text = input.value.trim();
    if (!text) return;

    addMessage("user", text);
    history.push({ role: "user", content: text });
    input.value = "";

    sending = true;
    sendBtn.disabled = true;
    var thinkingEl = addMessage("assistant", "Escribiendo…");

    try {
      var token = await getSessionToken(false);
      var response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ messages: history }),
      });

      if (response.status === 401) {
        // El token expiro justo a tiempo — se pide uno nuevo y se reintenta una vez.
        token = await getSessionToken(true);
        response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
          body: JSON.stringify({ messages: history }),
        });
      }

      var data = await response.json();

      thinkingEl.remove();

      if (!response.ok) {
        var errMsg =
          data && data.error && data.error.message
            ? data.error.message
            : "No pude responder en este momento. Intenta de nuevo.";
        addMessage("error", errMsg);
        return;
      }

      addMessage("assistant", data.message);
      history.push({ role: "assistant", content: data.message });

      // Limite razonable de historial enviado — evita que la conversacion
      // crezca sin fin (el servidor tambien lo valida, esto es solo UX).
      if (history.length > 20) {
        history = history.slice(-20);
      }
    } catch (err) {
      thinkingEl.remove();
      addMessage("error", "No pude conectarme. Revisa tu conexión e intenta de nuevo.");
    } finally {
      sending = false;
      sendBtn.disabled = false;
      input.focus();
    }
  });
})();
