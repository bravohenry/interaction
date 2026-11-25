import { streamText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
const apiKey = process.env.GEMINI_API_KEY;
console.log('apiKey prefix', apiKey?.slice(0,6));
const google = createGoogleGenerativeAI({ apiKey });
const run = streamText({
  model: google('models/gemini-2.0-flash'),
  messages: [{ role: 'user', content: 'hi, say hello' }],
});
let text='';
for await (const ch of run.textStream) text+=ch;
console.log('len', text.length);
console.log(text);
