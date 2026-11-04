import Schema from '@deepseek-ai/schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'

export const name = 'autocad-ai'
export const inject = ['tools']
export const Config = Schema.object({})

/**
 * Phase 0 echo tool — proves the plugin loaded and tools.register works.
 * Does not talk to AutoCAD, MCP, or OCCT.
 *
 * @param {unknown} _ctx Cordis context (unused in Phase 0)
 * @returns {ReturnType<typeof defineTool>}
 */
export function echoTool(_ctx) {
  return defineTool({
    name: 'autocad_ai_echo',
    description:
      'Phase 0 scaffold echo for the autocad-ai plugin. Returns the input message unchanged. Not an AutoCAD or MCP call.',
    parameters: {
      message: {
        type: 'string',
        required: true,
        description: 'Arbitrary text to echo back.',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          message: { type: 'string', required: true },
          plugin: { type: 'string', required: true },
        },
      },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
    },
    timeoutMs: 10_000,
    isConcurrencySafe: () => true,
    presentCall: (args) => ({
      card: 'generic',
      kind: 'execute',
      title: 'autocad-ai echo',
      rawInput: args,
    }),
    async execute(args) {
      const message = typeof args?.message === 'string' ? args.message : ''
      return { message, plugin: 'autocad-ai' }
    },
  })
}

/**
 * Apply the autocad-ai Cordis plugin.
 *
 * Future hooks (Phase 0 intentionally empty — do not implement here yet):
 * - MCP sidecar: launch/configure local stdio or loopback MCP server that
 *   wraps AutoCAD COM/.NET automation; register real CAD tools via that path.
 * - AutoCAD delivery path: BOM → layout → DWG only through the local MCP
 *   sidecar, never through remote MCP or OCCT export.
 * - OCCT preview: optional in-process viewer for conversation/shell preview;
 *   not a deliverable DWG path (DWG unsupported in OCCT preview).
 *
 * @param {import('@deepseek-ai/cordis').Context} ctx
 */
export function apply(ctx) {
  ctx.logger?.info?.('autocad-ai: Phase 0 scaffold loaded (echo tool only)')
  ctx.tools.register(echoTool(ctx))
}
