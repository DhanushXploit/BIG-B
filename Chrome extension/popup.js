document.addEventListener('DOMContentLoaded', function () {
  // Render any stored images on load
  chrome.storage.local.get(['imageUrls'], function (result) {
    if (result.imageUrls && result.imageUrls.length) {
      renderImages(result.imageUrls);
    }
  });

  // --- Save Text functionality ---
  document.getElementById("saveText").addEventListener("click", function () {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (tabs && tabs.length > 0) {
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          func: () => window.getSelection().toString().trim()
        }, (results) => {
          if (results && results[0] && results[0].result) {
            const selectedText = results[0].result;
            if (selectedText.length > 0 && selectedText.length < 1000) {
              showNotification("Text saved successfully!", 3000);
              chrome.runtime.sendMessage({
                type: "saveData",
                data: { text: selectedText, metadata: { url: tabs[0].url } }
              }, (response) => {
                if (response && response.status === "success") {
                  showMessage("Text stored in Milvus successfully!", 3000);
                } else {
                  showMessage("Failed to store text in Milvus.", 3000);
                }
              });
            } else {
              showNotification("Please select a smaller portion of text (< 1000 characters).", 3000);
            }
          } else {
            showNotification("No text selected.", 3000);
          }
        });
      }
    });
  });

  // --- Save Image functionality ---
  document.getElementById("saveImage").addEventListener("click", function () {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (tabs && tabs.length > 0) {
        const imageUrl = tabs[0].url;
        if (/\.(jpg|jpeg|png|gif|webp)$/i.test(imageUrl)) {
          chrome.storage.local.get(['imageUrls'], function (result) {
            let imageUrls = result.imageUrls || [];
            if (!imageUrls.includes(imageUrl)) {
              imageUrls.push(imageUrl);
              chrome.storage.local.set({ imageUrls: imageUrls }, function () {
                renderImages(imageUrls);
              });
            } else {
              renderImages(imageUrls);
            }
            showNotification("Image saved successfully!", 3000);
            fetch("http://127.0.0.1:5000/save-image", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                image_url: imageUrl,
                metadata: { source: "chrome-extension" }
              })
            })
              .then(response => response.json())
              .then(data => {
                if (data.status === "success") {
                  showMessage("Image stored in Milvus successfully!", 3000);
                } else {
                  showMessage("Error storing image in Milvus.", 3000);
                }
              })
              .catch(error => {
                console.error("Error:", error);
                showMessage("Error connecting to server.", 3000);
              });
          });
        } else {
          showNotification('The current tab does not appear to be an image.', 3000);
        }
      }
    });
  });
});

function showNotification(message, duration = 3000) {
  const notification = document.getElementById("notification");
  notification.innerText = message;
  notification.style.display = "block";
  setTimeout(() => { notification.style.display = "none"; }, duration);
}

function showMessage(message, duration = 3000) {
  const messageDiv = document.getElementById("message");
  messageDiv.innerText = message;
  setTimeout(() => { messageDiv.innerText = ""; }, duration);
}

function renderImages(images) {
  const imagesListDiv = document.getElementById("imagesList");
  imagesListDiv.innerHTML = "";
  images.forEach(url => {
    const container = document.createElement('div');
    container.className = 'imageContainer';

    const img = document.createElement('img');
    img.src = url;
    container.appendChild(img);

    const downloadBtn = document.createElement('button');
    downloadBtn.textContent = 'Download';
    downloadBtn.className = 'downloadIcon';
    downloadBtn.addEventListener('click', function () {
      chrome.downloads.download({ url: url });
    });
    container.appendChild(downloadBtn);

    imagesListDiv.appendChild(container);
  });
  imagesListDiv.style.display = images.length ? 'flex' : 'none';
}
