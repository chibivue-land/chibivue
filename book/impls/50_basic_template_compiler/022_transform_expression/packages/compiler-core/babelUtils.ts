import { Identifier, Node } from '@babel/types'

import { walk } from 'estree-walker'

export function walkIdentifiers(
  root: Node,
  onIdentifier: (node: Identifier) => void,
) {
  ;(walk as any)(root, {
    enter(node: Node) {
      if (node.type === 'Identifier') {
        onIdentifier(node)
      }
    },
  })
}
