---
'@kete-africa/ai': minor
'@kete-africa/agents': minor
'@kete-africa/tools': minor
'@kete-africa/settings': minor
---

Agents with abilities beyond the product (spec 129): `@kete/ai` says an answer aloud (`speech`, `speechModel`: OpenAI or Mistral's Voxtral) and searches the web with the model provider's own search (`webSearch`, `searchingModel`); `@kete/agents` gives an agent `web_search`, `web_read`, a computer of its own (`computerTools` on `@kete/sandbox`) and sub-agents (`AgentTurn.subAgents`), each bringing outside content, and `guardOutside` applies the outside-content rule to any loop; `@kete/settings` adds `kete.agent_abilities` (off by default) and `kete.spoken_answers`; `@kete/tools` shares the public-internet guard (`publicFetch`, `reachable`, `isPublicIp`).
