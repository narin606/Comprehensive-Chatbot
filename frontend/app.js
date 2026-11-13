const conversationEl = document.getElementById("conversation");
const chatForm = document.getElementById("chatForm");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const clearBtn = document.getElementById("clearBtn");
const backendUrlInput = document.getElementById("backendUrl");
const pingBtn = document.getElementById("pingBtn");
const pingStatus = document.getElementById("pingStatus");

let isSending = false;
let history = [];

const renderBubble = (text, role, sources = []) => {
  const bubble = document.createElement("div");
  bubble.classList.add("bubble", role);
  bubble.textContent = text;

  if (role === "bot" && sources.length > 0) {
    const sourceContainer = document.createElement("div");
    sourceContainer.classList.add("sources");
    sourceContainer.textContent = "Sources: ";
    sources.forEach((source) => {
      const pill = document.createElement("span");
      pill.textContent = source;
      sourceContainer.appendChild(pill);
    });
    bubble.appendChild(sourceContainer);
  }

  conversationEl.appendChild(bubble);
  conversationEl.scrollTop = conversationEl.scrollHeight;
};

const setSending = (state) => {
  isSending = state;
  sendBtn.disabled = state;
  messageInput.disabled = state;
};

const getBackendUrl = () => backendUrlInput.value.replace(/\/+$/, "");

const pingBackend = async () => {
  pingStatus.textContent = "Checking...";
  pingStatus.style.color = "var(--text-light)";
  try {
    const response = await fetch(`${getBackendUrl()}/health`);
    if (!response.ok) throw new Error("Health check failed");
    pingStatus.textContent = "Online";
    pingStatus.style.color = "#1ab394";
  } catch (error) {
    pingStatus.textContent = "Offline";
    pingStatus.style.color = "#e74c3c";
  }
};

pingBtn.addEventListener("click", pingBackend);

clearBtn.addEventListener("click", () => {
  conversationEl.innerHTML = "";
  history = [];
  messageInput.value = "";
});

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = messageInput.value.trim();
  if (!message || isSending) return;

  renderBubble(message, "user");
  history.push({ role: "user", content: message });
  messageInput.value = "";
  setSending(true);

  try {
    const response = await fetch(`${getBackendUrl()}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, history }),
    });

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    const payload = await response.json();
    renderBubble(payload.answer, "bot", payload.sources || []);
    history.push({ role: "assistant", content: payload.answer });
  } catch (error) {
    console.error(error);
    renderBubble(
      "There was a problem contacting the backend. Check the console and make sure the server is running.",
      "bot"
    );
  } finally {
    setSending(false);
    messageInput.focus();
  }
});

// Auto-ping backend on load.
pingBackend();
