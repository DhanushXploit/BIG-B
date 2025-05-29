document.addEventListener('DOMContentLoaded', () => {
    const queryInput = document.getElementById('queryInput');
    const micButton = document.getElementById('micButton');
    const submitButton = document.getElementById('submitButton');
    const recordingStatus = document.getElementById('recordingStatus');
    const responseContainer = document.getElementById('responseContainer');
    const responseText = document.getElementById('responseText');
    const audioPlayer = document.getElementById('audioPlayer');

    let recognition = null;
    if ('webkitSpeechRecognition' in window) {
        recognition = new webkitSpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onstart = () => {
            recordingStatus.textContent = '🎙️ Listening...';
            micButton.style.color = '#5eead4';
        };

        recognition.onend = () => {
            recordingStatus.textContent = '';
            micButton.style.color = '';
        };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            queryInput.value = transcript;
            submitQuery();
        };

        recognition.onerror = (event) => {
            recordingStatus.textContent = 'Error: ' + event.error;
            setTimeout(() => {
                recordingStatus.textContent = '';
            }, 3000);
        };
    }

    micButton.addEventListener('click', () => {
        if (recognition) {
            recognition.start();
        } else {
            recordingStatus.textContent = 'Speech recognition not supported';
            setTimeout(() => {
                recordingStatus.textContent = '';
            }, 3000);
        }
    });

    submitButton.addEventListener('click', submitQuery);
    queryInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            submitQuery();
        }
    });

    async function submitQuery() {
        const query = queryInput.value.trim();
        if (!query) return;

        // Show loading state
        responseContainer.classList.add('visible');
        responseText.innerHTML = 'Thinking... 🤔';
        audioPlayer.innerHTML = '';

        try {
            const response = await fetch('http://localhost:5000/ask', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ query }),
            });

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            const data = await response.json();
            
            // Update text response
            responseText.innerHTML = data.text;

            // Show retrieved sources
            const sourcesContainer = document.getElementById("retrievedSources");
            sourcesContainer.innerHTML = ""; // Clear previous sources

            if (data.sources && data.sources.length > 0) {
                data.sources.forEach((source, index) => {
                    const div = document.createElement("div");
                    div.className = "retrieved-source";
                    div.innerHTML = `
                        <p style="margin-top: 1rem;">
                            <strong>📄 Source ${index + 1}:</strong><br>
                            ${source.text}<br>
                            ${source.url ? `<a href="${source.url}" target="_blank">🔗 ${source.url}</a>` : ""}
                        </p>
                    `;
                    sourcesContainer.appendChild(div);
                });
            }


            // Handle audio if available
if (data.audio) {
    const audio = document.createElement('audio');
    audio.controls = true;
    audio.src = 'http://localhost:5000/audio';
    audioPlayer.innerHTML = '';
    audioPlayer.appendChild(audio);
}

// 🔽 Render retrieved images + descriptions
if (Array.isArray(data.images) && data.images.length > 0) {
    const imageSection = document.createElement('div');
    imageSection.style.marginTop = '1.5rem';
    imageSection.innerHTML = '<h3>🖼️ Retrieved Images:</h3>';

    data.images.forEach((item) => {
        const wrapper = document.createElement('div');
        wrapper.style.marginBottom = '1rem';

        const img = document.createElement('img');
        img.src = item.image_url;
        img.alt = 'Retrieved image';
        img.style.width = '100%';
        img.style.maxWidth = '500px';
        img.style.borderRadius = '8px';

        const desc = document.createElement('p');
        desc.textContent = item.metadata?.description || 'No description available';
        desc.style.marginTop = '0.5rem';
        desc.style.color = '#aaa';

        const link = document.createElement('a');
        link.href = item.image_url;
        link.target = '_blank';
        link.textContent = '🔗 View Full Image';
        link.style.display = 'block';
        link.style.marginTop = '0.3rem';

        wrapper.appendChild(img);
        wrapper.appendChild(desc);
        wrapper.appendChild(link);
        imageSection.appendChild(wrapper);
    });

    responseText.appendChild(imageSection);
}


        } catch (error) {
            responseText.innerHTML = 'Error: Could not connect to the server. Make sure the local server is running.';
        }

        // Clear input
        queryInput.value = '';
    }

    // Add some visual feedback for buttons
    [micButton, submitButton].forEach(button => {
        button.addEventListener('mousedown', () => {
            button.style.transform = 'scale(0.95)';
        });
        button.addEventListener('mouseup', () => {
            button.style.transform = '';
        });
        button.addEventListener('mouseleave', () => {
            button.style.transform = '';
        });
    });
});