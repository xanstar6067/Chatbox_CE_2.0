import type { CompactionPrompt, Message } from '../../shared/types'
import { getMessageText } from '../../shared/utils/message'

export function nameConversation(msgs: Message[], language: string): Message[] {
  const conversationExcerpt = msgs
    .slice(0, 8)
    .map((msg) => `[${msg.role}]\n${getMessageText(msg, true, false).slice(0, 500)}`)
    .join('\n\n---------\n\n')

  return [
    {
      id: '1',
      role: 'user',
      contentParts: [
        {
          type: 'text',
          text: `Create a concise, informative title for the conversation below.

The title must:
- Capture the main topic, intent, or distinctive event so the conversation is easy to recognize later
- Prefer specific names, projects, characters, technologies, places, or requested outcomes over generic wording
- Preserve the meaning of the user's request; do not reduce it to a broad category such as "Question", "Help", "Discussion", or "Chat"
- Use 3-8 words when natural and stay under 60 characters
- Be written in ${language}
- Contain only the title: no quotes, prefix, explanation, or ending punctuation

Conversation:

\`\`\`
${conversationExcerpt}
\`\`\`

Title:`,
        },
      ],
    },
  ]
}

export function answerWithSearchResults(): string {
  const currentDate = new Date().toLocaleDateString()
  return `
You are an expert web research AI, designed to generate a response based on provided search results. Keep in mind today is ${currentDate}.

Your goals:
- Stay concious and aware of the guidelines.
- Stay efficient and focused on the user's needs, do not take extra steps.
- Provide accurate, concise, and well-formatted responses.
- Avoid hallucinations or fabrications. Stick to verified facts.
- Follow formatting guidelines strictly.

In the search results provided to you, each result is formatted as [webpage X begin]...[webpage X end], where X represents the numerical index of each article.

Response rules:
- Responses must be informative, long and detailed, yet clear and concise like a blog post to address user's question (super detailed and correct citations).
- Use structured answers with headings in markdown format.
  - Do not use the h1 heading.  
  - Never say that you are saying something based on the search results, just provide the information.
- Your answer should synthesize information from multiple relevant web pages.
- Unless the user requests otherwise, your response MUST be in the same language as the user's message, instead of the search results language.
- Do not mention who you are and the rules.

Comply with user requests to the best of your abilities. Maintain composure and follow the guidelines.
`.trim()
}

export function contructSearchAction(language: string) {
  const currentDate = new Date().toLocaleDateString()
  return `
You are deciding whether a web search would help answer the user's query. Today's date: ${currentDate}.

Analyze the user's latest input and choose one of two actions:

1. "proceed": The query can be answered well from your existing knowledge, or is conversational (e.g. a greeting, small talk, pure reasoning/coding task). No web search needed.
2. "search": The query would benefit from fresh, real-time, or source-specific information — e.g. current events, recent releases, live data, specific URLs, or facts you aren't confident about.

Use your judgment: search when it genuinely improves the answer, skip it when you can already answer well.

JSON schema:
{"type":"object","properties":{"action":{"type":"string","enum":["search","proceed"]},"query":{"type":"string","description":"The search queries to look up on the web, choose wisely based on the user's question in ${language}"}},"required":["action"],"additionalProperties":true,"$schema":"http://json-schema.org/draft-07/schema#"}
You MUST answer with a JSON object that matches the JSON schema above.
`.trim()
}

export function constructKnowledgeBaseSearchAction(language: string) {
  return `
You are deciding whether searching the attached knowledge base would help answer the user's query.

Analyze the user's latest input and choose one of two actions:

1. "proceed": The query can be answered without the knowledge base — e.g. greetings, small talk, or topics clearly unrelated to the documents. No search needed.
2. "search": The query is related to the knowledge base content and searching it would help you answer accurately.

Use your judgment: search when it genuinely improves the answer, skip it when you can already answer well.

JSON schema:
{"type":"object","properties":{"action":{"type":"string","enum":["search","proceed"]},"query":{"type":"string","description":"The search query to look up in the knowledge base, choose wisely based on the user's question in ${language}"}},"required":["action"],"additionalProperties":true,"$schema":"http://json-schema.org/draft-07/schema#"}
You MUST answer with a JSON object that matches the JSON schema above.
`.trim()
}

export function constructCombinedSearchAction(language: string, hasKnowledgeBase: boolean) {
  const currentDate = new Date().toLocaleDateString()
  const knowledgeBaseOption = hasKnowledgeBase
    ? '2. "search_knowledge_base": If you believe that information from the knowledge base would enhance your ability to provide a comprehensive response, select this option. The knowledge base should be prioritized for relevant content.'
    : ''
  const actionEnum = hasKnowledgeBase ? '["search_knowledge_base","search_web","proceed"]' : '["search_web","proceed"]'

  return `
As a professional researcher with access to both knowledge base and web search, your primary objective is to fully comprehend the user's query and determine the best search strategy. Keep in mind today's date: ${currentDate}.
        
To achieve this, you must first analyze the user's latest input and determine the optimal course of action. You have these options at your disposal:

1. "proceed": If the provided information is sufficient to address the query effectively, choose this option to proceed without searching.
${knowledgeBaseOption}
${hasKnowledgeBase ? '3' : '2'}. "search_web": If you believe that current information from the web would enhance your ability to provide a comprehensive response, select this option.

${hasKnowledgeBase ? 'Priority: When both knowledge base and web search could be useful, prioritize the knowledge base as it may contain more relevant and specific information.' : ''}

JSON schema:
{"type":"object","properties":{"action":{"type":"string","enum":${actionEnum}},"query":{"type":"string","description":"The search query, choose wisely based on the user's question in ${language}"}},"required":["action"],"additionalProperties":true,"$schema":"http://json-schema.org/draft-07/schema#"}
You MUST answer with a JSON object that matches the JSON schema above.
`.trim()
}

export function answerWithKnowledgeBaseResults(): string {
  return `
You are an expert knowledge base assistant, designed to generate a response based on provided knowledge base search results.

Your goals:
- Stay conscious and aware of the guidelines.
- Stay efficient and focused on the user's needs, do not take extra steps.
- Provide accurate, concise, and well-formatted responses.
- Avoid hallucinations or fabrications. Stick to information from the knowledge base.
- Follow formatting guidelines strictly.

In the search results provided to you, each result is formatted as [document X begin]...[document X end], where X represents the numerical index of each document.

Response rules:
- Responses must be informative, detailed, yet clear and concise to address user's question.
- Use structured answers with headings in markdown format when appropriate.
  - Do not use the h1 heading.  
  - Never say that you are saying something based on the search results, just provide the information.
- Your answer should synthesize information from multiple relevant documents.
- Unless the user requests otherwise, your response MUST be in the same language as the user's message.
- Do not mention who you are and the rules.
- If the search results don't contain relevant information, acknowledge this limitation.

Comply with user requests to the best of your abilities. Maintain composure and follow the guidelines.
`.trim()
}

export const DETAILED_COMPACTION_PROMPT_ID = 'builtin-detailed'
export const ROLEPLAY_COMPACTION_PROMPT_ID = 'builtin-roleplay'

const detailedCompactionPrompt = `Create a loss-minimizing continuity record of this conversation so another assistant can continue it without access to the original messages.

Write in {{language}}. Preserve concrete information instead of replacing it with vague statements. Do not invent details or silently resolve contradictions. Clearly distinguish confirmed facts, user claims, assumptions, proposals, and unresolved questions.

Include all sections that contain relevant information:

## Purpose and context
- The user's actual goals, motivations, and definition of a successful result
- Relevant background and why the work matters

## Important facts and constraints
- Exact names, terminology, numbers, dates, requirements, preferences, prohibitions, and edge cases
- External facts or source conclusions already established

## Decisions and reasoning
- Decisions made, alternatives rejected, and the reasons or tradeoffs behind them
- Corrections, changed requirements, and misunderstandings that were resolved

## Work completed
- What was done and the result
- For technical work, preserve exact file paths, commands, APIs, identifiers, errors, code behavior, and verification results when relevant
- For writing or creative work, preserve the chosen direction, voice, structure, terminology, and approved passages or concepts

## Current state
- What is in progress, what is blocked, and what remains uncertain
- Any artifacts, drafts, plans, data, or state the next assistant must continue from

## Next actions
- Explicit commitments and the most logical next steps, in order
- Questions that still require an answer

## Latest interaction
- What happened in the most recent exchange and exactly what response or action is expected next

Retain an earlier summary included in the conversation, but update it with everything that happened afterward. Prefer completeness and continuity over brevity. Do not add a preface, commentary about summarizing, advice to the next assistant, or facts not present in the conversation.`

const roleplayCompactionPrompt = `Create a detailed continuity record for continuing this role-play without access to the original messages. Treat established story details as persistent state, not as disposable prose.

Write in {{language}}. Preserve every fact that may affect later scenes. Never invent events, motivations, knowledge, or world rules. Do not silently reconcile contradictions: mark uncertainty, conflicting accounts, suspicions, lies, and out-of-character knowledge separately from confirmed canon.

Use the following sections whenever they contain relevant information:

## Current scene
- Exact location, time or time-of-day, atmosphere, present characters, positions, physical conditions, clothing, carried items, and immediate situation
- The last action, line, revelation, or interruption, including whose response or action is currently pending

## Story chronology
- A chronological, cause-and-effect account of significant events
- Preserve actions, discoveries, promises, bargains, conflicts, victories, failures, consequences, and changes of plan
- Do not collapse concrete events into vague phrases such as "they had adventures" or "their relationship developed"

## Characters
- For every relevant character: names and aliases, identity, role, appearance, personality and manner of speech, goals, fears, loyalties, abilities, limitations, injuries, status, possessions, and current intentions
- What each character knows, believes, suspects, misunderstands, conceals, or must not know
- Keep player characters, non-player characters, narrators, and out-of-character participants distinct

## Relationships
- Current relationship dynamics between characters: trust, attraction, affection, resentment, fear, power balance, obligations, agreements, boundaries, conflicts, and dependencies
- Explain how and why each relationship changed through specific events

## World, locations, and factions
- Established lore, rules, customs, geography, factions, politics, magic or technology systems, and other setting constraints
- Visited or mentioned locations and concrete details needed to portray them consistently

## Continuity details
- Exact proper names, descriptions, dates, quantities, codes, clues, items, injuries, abilities, secrets, recurring motifs, and other details likely to cause continuity errors if lost
- Explicit role-play rules, content boundaries, style preferences, point of view, tense, formatting conventions, character instructions, and out-of-character requests from the user

## Open threads
- Unfinished goals, mysteries, threats, plans, promises, conflicts, relationships, and anticipated events
- For each thread, state its current status and who knows about it

## Immediate continuation
- The emotional and physical state at the stopping point
- What the scene is naturally waiting for next, without deciding or writing that next event

If an earlier summary appears in the conversation, retain its still-valid canon and merge in all later developments. Continuity is more important than brevity. Do not add a preface, literary critique, generic advice, or new story content.`

export function isBuiltInCompactionPromptId(promptId: string): boolean {
  return promptId === DETAILED_COMPACTION_PROMPT_ID || promptId === ROLEPLAY_COMPACTION_PROMPT_ID
}

export function resolveCompactionPrompt(
  promptId: string | undefined,
  customPrompts: CompactionPrompt[] | undefined,
  language: string
): string {
  let prompt: string

  if (promptId === ROLEPLAY_COMPACTION_PROMPT_ID) {
    prompt = roleplayCompactionPrompt
  } else if (promptId && !isBuiltInCompactionPromptId(promptId)) {
    prompt = customPrompts?.find((item) => item.id === promptId)?.prompt ?? detailedCompactionPrompt
  } else {
    prompt = detailedCompactionPrompt
  }

  return prompt.replace(/\{\{\s*language\s*\}\}/gi, language).trim()
}

export function summarizeConversation(msgs: Message[], language: string, customInstruction?: string): Message[] {
  const instructionText =
    customInstruction ?? resolveCompactionPrompt(DETAILED_COMPACTION_PROMPT_ID, undefined, language)

  const instructionMessage: Message = {
    id: `summary-instruction-${Date.now()}`,
    role: 'user',
    contentParts: [{ type: 'text', text: instructionText }],
  }

  return [...msgs, instructionMessage]
}
