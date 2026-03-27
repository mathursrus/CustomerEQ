// LLM client configuration
// Primary: GPT-4o (best cost/quality for structured extraction)
// Fast: GPT-4o-mini (high-throughput, low-cost)
// Fallback: Round-robin for resilience

retry_policy ExponentialBackoff {
  max_retries 2
  strategy {
    type exponential_backoff
    delay_ms 300
    multiplier 1.5
  }
}

retry_policy ConstantRetry {
  max_retries 3
  strategy {
    type constant_delay
    delay_ms 200
  }
}

client<llm> GPT4o {
  provider openai
  options {
    model "gpt-4o"
    api_key env.OPENAI_API_KEY
    max_tokens 2048
  }
}

client<llm> GPT4oMini {
  provider openai
  retry_policy ExponentialBackoff
  options {
    model "gpt-4o-mini"
    api_key env.OPENAI_API_KEY
    max_tokens 1024
  }
}

// Legacy Claude clients kept as fallbacks
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
  retry_policy ConstantRetry
  options {
    model "claude-haiku-4-5-20251001"
    api_key env.ANTHROPIC_API_KEY
    max_tokens 1024
  }
}

// Resilient fallback: GPT-4o-mini primary, Claude Haiku backup
client<llm> FastFallback {
  provider fallback
  options {
    strategy [GPT4oMini, ClaudeFast]
  }
}
