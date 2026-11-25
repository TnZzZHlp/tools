import { cloneVNode, defineComponent, Fragment, isVNode, type VNode } from 'vue'

function findElement(nodes: unknown[]): VNode | undefined {
  for (const node of nodes) {
    if (!isVNode(node)) continue
    if (node.type === Fragment && Array.isArray(node.children)) {
      const child = findElement(node.children)
      if (child) return child
    } else if (
      typeof node.type === 'string' ||
      typeof node.type === 'object' ||
      typeof node.type === 'function'
    ) {
      return node
    }
  }
  return undefined
}

export const RenderChild = defineComponent({
  inheritAttrs: false,
  setup(_, { attrs, slots }) {
    return () => {
      const child = findElement(slots.default?.() ?? [])
      return child ? cloneVNode(child, attrs, true) : null
    }
  },
})
