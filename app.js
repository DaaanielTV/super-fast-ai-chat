document.addEventListener('DOMContentLoaded', () => {
    const chatContainer = document.querySelector('.chat-container');
    const chatMessages = document.querySelector('.chat-messages');
    const chatInput = document.querySelector('.chat-input');
    const welcomeScreen = document.querySelector('.welcome-screen');
    
    let isProcessing = false;

    console.log('Chat interface initialized');

    // System prompt for thinking process
    const SYSTEM_PROMPT = `
    You are a helpful AI assistant. When you receive a question, first think about it and provide your thinking process in "think" tags.
    Example:
    Question: What is the capital of France?
    Answer: <think>
    The capital of France is Paris. Paris is known for the Eiffel Tower and is one of the largest cities in Europe.
    </think>
    The capital of France is Paris.

    Always keep your thoughts within these <think></think> tags and your final answer outside these tags.
    `;

    // Auto-resize textarea
    chatInput.addEventListener('input', () => {
        chatInput.style.height = 'auto';
        chatInput.style.height = chatInput.scrollHeight + 'px';
    });

    // Send message on Enter (without Shift)
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            console.log('Enter key pressed');
            e.preventDefault();
            sendMessage();
        }
    });

    function addMessage(content, isUser = false, isThinking = false) {
        if (welcomeScreen) {
            welcomeScreen.remove();
        }

        const message = document.createElement('div');
        message.className = `message ${isUser ? 'user-message' : ''}`;
        
        let formattedContent = content;
        if (isThinking) {
            formattedContent = formatThinkingBlock(content);
        }

        message.innerHTML = `
            <div class="avatar ${isUser ? 'user-avatar' : ''}">
                <svg viewBox="0 0 24 24">
                    <path d="${isUser ? 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z' : 'M20 12a8 8 0 0 0-8-8A8 8 0 0 0 4 12a8 8 0 0 0 8 8 8 8 0 0 0 8-8m2 0A10 10 0 0 1 12 22 10 10 0 0 1 2 12 10 10 0 0 1 12 2a10 10 0 0 1 10 10'}"/>
                </svg>
            </div>
            <div class="message-content">
                <div class="message-header">
                    <span class="message-sender">${isUser ? 'You' : 'AI'}</span>
                    <span class="message-time">${new Date().toLocaleTimeString()}</span>
                </div>
                <div class="message-text">${formattedContent}</div>
            </div>
        `;

        chatMessages.appendChild(message);
        message.scrollIntoView({ behavior: 'smooth' });
        return message;
    }

    async function sendMessage() {
        const message = chatInput.value.trim();
        console.log('Attempting to send message:', message);

        if (!message) {
            console.log('Message is empty, ignoring');
            return;
        }

        if (isProcessing) {
            console.log('Already processing a message, ignoring');
            return;
        }

        isProcessing = true;
        console.log('Processing started');

        const userMessageElement = addMessage(message, true);
        chatInput.value = '';
        chatInput.style.height = 'auto';

        const thinkingMessage = addMessage('🤔 Thinking...', false);

        try {
            console.log('Sending request to Ollama API...');
            
            // First try to verify API is accessible
            const healthCheck = await fetch('http://localhost:11434/api/tags', {
                method: 'GET'
            });
            
            if (!healthCheck.ok) {
                throw new Error('Ollama API is not accessible');
            }

            const response = await fetch('http://localhost:11434/api/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'qwen2.5:0.5b',
                    prompt: message,
                    stream: false
                })
            });

            console.log('Response status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('API Error Response:', errorText);
                throw new Error(`API request failed with status ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            console.log('API Response:', data);

            // Update the thinking message with the response
            if (data.response) {
                thinkingMessage.querySelector('.message-text').innerHTML = data.response;
            } else {
                throw new Error('No response from API');
            }

            thinkingMessage.scrollIntoView({ behavior: 'smooth' });

        } catch (error) {
            console.error('Error in sendMessage:', {
                name: error.name,
                message: error.message,
                stack: error.stack,
                timestamp: new Date().toISOString()
            });
            
            let errorMessage = '⚠️ Error: ';
            
            if (error.message.includes('Failed to fetch') || error.message.includes('not accessible')) {
                errorMessage += 'Could not connect to Ollama API. Please check if:\n\n' +
                              '1. Ollama is running:\n   systemctl status ollama\n\n' +
                              '2. Test the API:\n   curl -X POST http://localhost:11434/api/generate -d \'{"model":"qwen2.5:0.5b","prompt":"hello","stream":false}\'\n\n' +
                              '3. Model is installed:\n   ollama list\n\n' +
                              '4. Port 11434 is accessible';
            } else if (error.message.includes('404')) {
                errorMessage += 'API endpoint not found. Make sure Ollama API is running on port 11434';
            } else if (error.message.includes('500')) {
                errorMessage += 'Server error. Check Ollama logs:\n   journalctl -u ollama -f';
            } else {
                errorMessage += `${error.message}\n\nPlease check the browser console for more details.`;
            }

            thinkingMessage.querySelector('.message-text').innerHTML = errorMessage;
        } finally {
            console.log('Processing complete');
            isProcessing = false;
        }
    }

    // Initialize suggestion chips
    const suggestionsContainer = document.querySelector('.suggestion-chips');
    if (suggestionsContainer) {
        const selectedPrompts = suggestionPrompts
            .sort(() => 0.5 - Math.random())
            .slice(0, 3);
        
        selectedPrompts.forEach(prompt => {
            const chip = document.createElement('div');
            chip.className = 'suggestion-chip';
            chip.textContent = prompt;
            chip.addEventListener('click', () => {
                chatInput.value = prompt;
                sendMessage();
            });
            suggestionsContainer.appendChild(chip);
        });
    }

    console.log('Chat interface ready');
});