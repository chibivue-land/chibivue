import {
  type DirectiveNode,
  ElementTypes,
  type JSChildNode,
  NodeTypes,
  type Position,
  type RootNode,
  type SimpleExpressionNode,
  type SlotOutletNode,
  type SourceLocation,
  type TemplateChildNode,
} from './ast'

const nonIdentifierRE = /^\d|[^\$\w]/
export const isSimpleIdentifier = (name: string): boolean =>
  !nonIdentifierRE.test(name)

export const isStaticExp = (p: JSChildNode): p is SimpleExpressionNode =>
  p.type === NodeTypes.SIMPLE_EXPRESSION && p.isStatic

const enum MemberExpLexState {
  inMemberExp,
  inBrackets,
  inParens,
  inString,
}

const whitespaceRE = /\s+[.[]\s*|\s*[.[]\s+/g
const validFirstIdentCharRE = /[A-Za-z_$\xA0-\uFFFF]/
const validIdentCharRE = /[\.\?\w$\xA0-\uFFFF]/

export const isMemberExpression = (path: string): boolean => {
  path = path.trim().replace(whitespaceRE, s => s.trim())
  let state = MemberExpLexState.inMemberExp
  let stateStack: MemberExpLexState[] = []
  let currentOpenBracketCount = 0
  let currentOpenParensCount = 0
  let currentStringType: "'" | '"' | '`' | null = null

  for (let i = 0; i < path.length; i++) {
    const char = path.charAt(i)
    switch (state) {
      case MemberExpLexState.inMemberExp:
        if (char === '[') {
          stateStack.push(state)
          state = MemberExpLexState.inBrackets
          currentOpenBracketCount++
        } else if (char === '(') {
          stateStack.push(state)
          state = MemberExpLexState.inParens
          currentOpenParensCount++
        } else if (
          !(i === 0 ? validFirstIdentCharRE : validIdentCharRE).test(char)
        ) {
          return false
        }
        break
      case MemberExpLexState.inBrackets:
        if (char === `'` || char === `"` || char === '`') {
          stateStack.push(state)
          state = MemberExpLexState.inString
          currentStringType = char
        } else if (char === `[`) {
          currentOpenBracketCount++
        } else if (char === `]`) {
          if (!--currentOpenBracketCount) {
            state = stateStack.pop()!
          }
        }
        break
      case MemberExpLexState.inParens:
        if (char === `'` || char === `"` || char === '`') {
          stateStack.push(state)
          state = MemberExpLexState.inString
          currentStringType = char
        } else if (char === `(`) {
          currentOpenParensCount++
        } else if (char === `)`) {
          // if the exp ends as a call then it should not be considered valid
          if (i === path.length - 1) {
            return false
          }
          if (!--currentOpenParensCount) {
            state = stateStack.pop()!
          }
        }
        break
      case MemberExpLexState.inString:
        if (char === currentStringType) {
          state = stateStack.pop()!
          currentStringType = null
        }
        break
    }
  }
  return !currentOpenBracketCount && !currentOpenParensCount
}

export function toValidAssetId(
  name: string,
  type: 'component', // | TODO:
): string {
  return `_${type}_${name.replace(/[^\w]/g, (searchValue, replaceValue) => {
    return searchValue === '-' ? '_' : name.charCodeAt(replaceValue).toString()
  })}`
}

export function getInnerRange(
  loc: SourceLocation,
  offset: number,
  length: number,
): SourceLocation {
  const source = loc.source.slice(offset, offset + length)
  const newLoc: SourceLocation = {
    source,
    start: advancePositionWithClone(loc.start, loc.source, offset),
    end: loc.end,
  }

  if (length != null) {
    newLoc.end = advancePositionWithClone(
      loc.start,
      loc.source,
      offset + length,
    )
  }

  return newLoc
}

export function advancePositionWithClone(
  pos: Position,
  source: string,
  numberOfCharacters: number = source.length,
): Position {
  return advancePositionWithMutation({ ...pos }, source, numberOfCharacters)
}

export function advancePositionWithMutation(
  pos: Position,
  source: string,
  numberOfCharacters: number = source.length,
): Position {
  let linesCount = 0
  let lastNewLinePos = -1
  for (let i = 0; i < numberOfCharacters; i++) {
    if (source.charCodeAt(i) === 10 /* newline char code */) {
      linesCount++
      lastNewLinePos = i
    }
  }

  pos.offset += numberOfCharacters
  pos.line += linesCount
  pos.column =
    lastNewLinePos === -1
      ? pos.column + numberOfCharacters
      : numberOfCharacters - lastNewLinePos

  return pos
}

export function isStaticArgOf(
  arg: DirectiveNode['arg'],
  name: string,
): boolean {
  return !!(arg && isStaticExp(arg) && arg.content === name)
}

export function isSlotOutlet(
  node: RootNode | TemplateChildNode,
): node is SlotOutletNode {
  return node.type === NodeTypes.ELEMENT && node.tagType === ElementTypes.SLOT
}
