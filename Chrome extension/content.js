// Optional: Listen for messages (for future use).
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "getSelectedText") {
    const selectedText = window.getSelection().toString().trim();
    sendResponse({ text: selectedText.length > 0 ? selectedText : null });
  }
});

// Immediately collect image URLs on the page and store them in chrome.storage.
(function () {
  const images = document.querySelectorAll('img');
  const imageUrls = Array.from(images).map(img => img.src);
  chrome.storage.local.set({ imageUrls }, function () {
    console.log('Image URLs are stored.');
  });
})();
