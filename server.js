import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

// Initialize environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// Serve static files
app.use(express.static(__dirname));
app.use(express.json());

// Route for the main page
app.get('/', (req, res) => {
    res.sendFile(join(__dirname, 'index.html'));
});

// Proxy route for Ollama API
app.post('/api/generate', async (req, res) => {
    try {
        const response = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: process.env.OLLAMA_MODEL || 'qwen2.5:0.5b',
                prompt: req.body.prompt,
                system: req.body.system,
                stream: true
            })
        });

        if (!response.ok) {
            throw new Error(`Ollama API error: ${response.status}`);
        }

        // Set headers for streaming
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        // Pipe the Ollama response directly to the client
        response.body.pipe(res);

    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ 
            error: 'Failed to communicate with Ollama API',
            details: error.message
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});