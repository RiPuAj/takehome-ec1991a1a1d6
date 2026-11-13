import express from 'express';
import http from 'http';
import dotenv from 'dotenv';
import { createMessagesRouter } from './routes/messages.js';
import { createConversationsRouter } from './routes/conversations.js';
import { createProposalsRouter } from './routes/proposals.js';

import { MessageModel } from './models/message.js';
import { ProposalModel } from './models/proposal.js';
import { ConversationModel } from './models/conversation.js';

import { LLMService } from './services/llmService.js';

dotenv.config(".env");

const app = express();
app.use(express.json());
app.disable('x-powered-by');

// Routes
const llmService = new LLMService();
app.use('/api/messages',createMessagesRouter({ MessageModel, ProposalModel, llmService }));
app.use('/api/conversations', createConversationsRouter({ConversationModel}));
app.use('/api/proposals', createProposalsRouter({ ProposalModel }));

app.get('/', (req, res) => {
  res.send('<h1>Welcome to the backend server!</h1>');
});


app.use((req, res) => {
  res.status(404).send('<h1>404 Not Found</h1>');
})



const server = http.createServer(app);
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});