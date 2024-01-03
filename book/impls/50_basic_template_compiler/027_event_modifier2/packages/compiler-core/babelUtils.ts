import { Identifier, Node } from '@babel/types'

import { walk } from 'estree-walker'

export function walkIdentifiers(
  root: Node,
  onIdentifier: (node: Identifier) => void,
  knownIds: Record<string, number> = Object.create(null),
) {
  ;(walk as any)(root, {
    enter(node: Node) {
      if (node.type === 'Identifier') {
        const isLocal = !!knownIds[node.name]
        if (!isLocal) {
          onIdentifier(node)
        }
      }
    },
  })
}
