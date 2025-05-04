let currentPopup = null;

document.addEventListener("mouseup", handleSelection);
document.addEventListener("mousedown", hidePopupOnClickOutside);

function handleSelection(event) {
  setTimeout(() => {
    const selectedText = window.getSelection().toString().trim();
    removePopup();

    if (selectedText.length > 1 && /^[a-zA-Z]+$/.test(selectedText)) {
      const range = window.getSelection().getRangeAt(0);
      const rect = range.getBoundingClientRect();

      const popup = createInlinePopup(selectedText, event.pageX, event.pageY);
      document.body.appendChild(popup);
      currentPopup = popup;
    }
  }, 0);
}

function createInlinePopup(text, pageX, pageY) {
  const popup = document.createElement("div");
  popup.id = "vocal-inline-popup";
  popup.style.left = `${pageX}px`;
  popup.style.top = `${pageY - 40}px`;
  popup.style.transform = "translateX(-50%)";

  const translateBtn = document.createElement("button");
  translateBtn.textContent = "Translate";
  translateBtn.onclick = (e) => {
    e.stopPropagation();
    removePopup(); // Hide inline popup immediately

    chrome.runtime.sendMessage(
      { action: "getDetailsAndShowPopup", text: text },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error("Error sending message:", chrome.runtime.lastError);
          return;
        }
        if (response && !response.success) {
          console.error("Background script failed:", response.message);
        }
      }
    );
  };

  const addBtn = document.createElement("button");
  addBtn.textContent = "Add to study";
  addBtn.onclick = (e) => {
    e.stopPropagation();
    removePopup(); // Hide inline popup immediately

    chrome.runtime.sendMessage(
      { action: "addWord", text: text },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error(chrome.runtime.lastError);
          alert("Error: " + chrome.runtime.lastError.message);
          return;
        }
        if (response && response.success) {
          alert(`Added "${text}" to study list.`);
        } else {
          alert(`Failed to add "${text}". ${response?.message || ""}`);
        }
      }
    );
  };

  popup.appendChild(translateBtn);
  popup.appendChild(addBtn);

  return popup;
}

function removePopup() {
  if (currentPopup) {
    currentPopup.remove();
    currentPopup = null;
  }
}

function hidePopupOnClickOutside(event) {
  if (currentPopup && !currentPopup.contains(event.target)) {
    removePopup();
  }
}
