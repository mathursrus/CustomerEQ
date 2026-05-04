// BAML code generator configuration
// Generates TypeScript client in src/generated/

generator target {
  output_type "typescript"
  output_dir "../src/generated"
  version "0.211.0"
  // Emit relative imports with .js extensions for Node 22 ESM strict
  // resolution. Without this, generated `from "./async_client"` (no
  // extension) crashes at module-load time with ERR_MODULE_NOT_FOUND
  // in the production runtime. See #273 for the regression history.
  module_format "esm"
}
