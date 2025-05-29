chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension installed successfully!");
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "saveData" && message.data.text) {
    const text = message.data.text.trim();
    if (!text || text.length > 2000) {
      console.warn("Rejected suspicious or oversized text.");
      sendResponse({ status: "rejected", reason: "text too long or empty" });
      return true;
    }

    fetch("http://localhost:5000/save-text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: text,
        metadata: message.data.metadata
      })
    })
      .then(response => response.json())
      .then(data => sendResponse({ status: "success" }))
      .catch(error => {
        console.error("Error in saveData:", error);
        sendResponse({ status: "failure" });
      });

    return true;
  }
});
