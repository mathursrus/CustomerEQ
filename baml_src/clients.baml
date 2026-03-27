// LLM client configuration

client<llm> Claude {
  provider anthropic
  options {
    model "claude-sonnet-4-20250514"
    api_key env.ANTHROPIC_API_KEY
    max_tokens 2048
  }
}

client<llm> ClaudeFast {
  provider anthropic
  options {
    model "claude-haiku-4-5-20251001"
    api_key env.ANTHROPIC_API_KEY
    max_tokens 1024
  }
}
