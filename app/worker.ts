import { ChatWindowMessage } from "@/schema/ChatWindowMessage";

import { Voy as VoyClient } from "voy-search";

import { WebPDFLoader } from "langchain/document_loaders/web/pdf";
import { HuggingFaceTransformersEmbeddings } from "langchain/embeddings/hf_transformers";
import { VoyVectorStore } from "langchain/vectorstores/voy";
import { ChatOllama } from "langchain/chat_models/ollama";
import { Document } from "langchain/document";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
  PromptTemplate,
} from "langchain/prompts";
import { BaseLanguageModel } from "langchain/base_language";
import { BaseRetriever } from "langchain/schema/retriever";
import { RunnableSequence } from "langchain/schema/runnable";
import { StringOutputParser } from "langchain/schema/output_parser";
import { AIMessage, BaseMessage, HumanMessage } from "langchain/schema";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

const embeddings = new HuggingFaceTransformersEmbeddings({
  modelName: "Xenova/all-MiniLM-L6-v2",
});

const voyClient = new VoyClient();
const vectorstore = new VoyVectorStore(voyClient, embeddings);
const ollama = new ChatOllama({
  baseUrl: "http://ec2-13-233-147-129.ap-south-1.compute.amazonaws.com:11435",
  temperature: 0.3,
  model: "mistral",
});

const REPHRASE_QUESTION_TEMPLATE = `Given the following conversation and a follow up question, rephrase the follow up question to be a standalone question.

Chat History:
{chat_history}
Follow Up Input: {question}
Standalone Question:`;

const rephraseQuestionChainPrompt = PromptTemplate.fromTemplate(
  REPHRASE_QUESTION_TEMPLATE,
);

const RESPONSE_SYSTEM_TEMPLATE = `You are an AI language model skilled in refining and optimizing product descriptions. When presented with a product description, ask the user which transformation options they'd like applied, and then generate an improved version based on their selection. Each directive corresponds to a specific style, tone, or structural change:

EXPAND (50-200 words): Elaborate on the description, adding more detail.
SHORTEN (10-50 words): Condense the description while retaining key points.
MIMIC MY STYLE: Imitate the user's distinct writing style.
SIMPLIFY: Use basic language and straightforward sentences.
FIX GRAMMAR: Correct any grammatical errors.
COMPLICATE: Use advanced vocabulary and complex sentence structures.
PROFESSIONAL: Employ a formal and authoritative tone.
CONFIDENT: Convey assurance and certainty.
CASUAL: Use informal language and a relaxed tone.
FRIENDLY: Convey warmth and approachability.
STRAIGHTFORWARD: Be direct and to the point.
STORY: Incorporate narrative elements.
SCARY: Evoke fear and unease.
LOVECRAFT: Emulate H.P. Lovecraft's horror writing style.
CLARITY: Ensure the message is unambiguous and clear.
ADD HEADINGS: Incorporate subheadings for structure.
1ST PERSON: Use a first-person perspective.
REFINE: Enhance the overall quality and polish.
3RD PERSON: Use a third-person perspective.
ILLUSTRATE: Provide visual imagery through descriptive language.
TRANSLATE: Render the description in a different language (specify which).
ENRICH: Add layers of depth and detail.
HUMANIZE: Make the description relatable and emotive.
First, ask: "Which transformation options would you like to apply to your product description?" Once the user has specified their choices, transform the description using the selected styles and tones, ensuring the final result is coherent and effective. Then, indicate which options have been applied. Example:

User Input: "A beautiful Chest of Drawers made from Solid Wood..."
AI Question: "Which transformation options would you like to apply to your product description?"
User Selection: REFINE, PROFESSIONAL
Output: "Crafted by skilled artisans in Jodhpur, this exquisite Chest of Drawers is a testament to superior woodworking... (Options applied: REFINE, PROFESSIONAL)"`;

const responseChainPrompt = ChatPromptTemplate.fromMessages<{
  context: string;
  chat_history: BaseMessage[];
  question: string;
}>([
  ["system", RESPONSE_SYSTEM_TEMPLATE],
  new MessagesPlaceholder("chat_history"),
  ["user", `{question}`],
]);

const formatDocs = (docs: Document[]) => {
  return docs
    .map((doc, i) => `<doc id='${i}'>${doc.pageContent}</doc>`)
    .join("\n");
};

const createRetrievalChain = (
  llm: BaseLanguageModel,
  retriever: BaseRetriever,
  chatHistory: ChatWindowMessage[],
) => {
  if (chatHistory.length) {
    return RunnableSequence.from([
      rephraseQuestionChainPrompt,
      llm,
      new StringOutputParser(),
      retriever,
      formatDocs,
    ]);
  } else {
    return RunnableSequence.from([
      (input) => input.question,
      retriever,
      formatDocs,
    ]);
  }
};

const embedPDF = async (pdfBlob: Blob) => {
  const pdfLoader = new WebPDFLoader(pdfBlob);
  const docs = await pdfLoader.load();

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 500,
    chunkOverlap: 50,
  });

  const splitDocs = await splitter.splitDocuments(docs);

  self.postMessage({
    type: "log",
    data: splitDocs,
  });

  await vectorstore.addDocuments(splitDocs);
};

const _formatChatHistoryAsMessages = async (
  chatHistory: ChatWindowMessage[],
) => {
  return chatHistory.map((chatMessage) => {
    if (chatMessage.role === "human") {
      return new HumanMessage(chatMessage.content);
    } else {
      return new AIMessage(chatMessage.content);
    }
  });
};

const queryVectorStore = async (messages: ChatWindowMessage[]) => {
  const text = messages[messages.length - 1].content;
  const chatHistory: ChatWindowMessage[] = messages.slice(0, -1);

  const retrievalChain = createRetrievalChain(
    ollama,
    vectorstore.asRetriever(),
    chatHistory,
  );
  const responseChain = RunnableSequence.from([
    responseChainPrompt,
    ollama,
    new StringOutputParser(),
  ]);

  const fullChain = RunnableSequence.from([
    {
      question: (input) => input.question,
      chat_history: RunnableSequence.from([
        (input) => input.chat_history,
        _formatChatHistoryAsMessages,
      ]),
      context: RunnableSequence.from([
        (input) => {
          const formattedChatHistory = input.chat_history
            .map(
              (message: ChatWindowMessage) =>
                `${message.role.toUpperCase()}: ${message.content}`,
            )
            .join("\n");
          return {
            question: input.question,
            chat_history: formattedChatHistory,
          };
        },
        retrievalChain,
      ]),
    },
    responseChain,
  ]);

  const stream = await fullChain.stream({
    question: text,
    chat_history: chatHistory,
  });

  for await (const chunk of stream) {
    if (chunk) {
      self.postMessage({
        type: "chunk",
        data: chunk,
      });
    }
  }

  self.postMessage({
    type: "complete",
    data: "OK",
  });
};

// Listen for messages from the main thread
self.addEventListener("message", async (event: any) => {
  self.postMessage({
    type: "log",
    data: `Received data!`,
  });

  if (event.data.pdf) {
    try {
      await embedPDF(event.data.pdf);
    } catch (e: any) {
      self.postMessage({
        type: "error",
        error: e.message,
      });
      throw e;
    }
  } else {
    try {
      await queryVectorStore(event.data.messages);
    } catch (e: any) {
      self.postMessage({
        type: "error",
        error: `${e.message}. Make sure you are running Ollama.`,
      });
      throw e;
    }
  }

  self.postMessage({
    type: "complete",
    data: "OK",
  });
});
