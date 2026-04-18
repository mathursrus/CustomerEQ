// LLM client configuration
// Aligned to the local Codex Azure OpenAI profile:
// - base_url: https://sid-mj8313v0-eastus2.openai.azure.com/openai/v1
// - model: gpt-5.4
//
// The local Codex profile uses the Azure v1 endpoint and GPT-5.4.
// For GPT-5-class models, try the Responses API provider so BAML can
// serialize requests in the newer OpenAI/Azure wire shape.

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
  provider openai-responses
  options {
    base_url env.AZURE_OPENAI_BASE_URL
    api_key env.AZURE_OPENAI_API_KEY
    model "gpt-5.4"
    reasoning {
      effort "medium"
    }
  }
}

client<llm> GPT4oMini {
  provider openai-responses
  retry_policy ExponentialBackoff
  options {
    base_url env.AZURE_OPENAI_BASE_URL
    api_key env.AZURE_OPENAI_API_KEY
    model "gpt-5.4"
    reasoning {
      effort "medium"
    }
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
