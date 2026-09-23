export type FuzzyMatch = {
  score: number
  positions: number[]
}

type Word = {
  text: string
  start: number
}

export function fuzzyMatch(text: string, query: string): FuzzyMatch | undefined {
  const terms = query.toLocaleLowerCase().split(/[\s/-]+/u).filter(Boolean)
  if (terms.length === 0) return undefined

  const words = splitWords(text)
  const positions = new Set<number>()
  let score = 0

  for (const term of terms) {
    const candidates = words
      .map((word) => ({ word, match: matchWord(word.text, term) }))
      .filter((candidate): candidate is { word: Word; match: FuzzyMatch } => candidate.match !== undefined)
      .sort((left, right) => right.match.score - left.match.score || left.word.start - right.word.start)
    const best = candidates[0]
    if (!best) return undefined

    best.match.positions.forEach((position) => positions.add(best.word.start + position))
    score += best.match.score
  }

  return { score, positions: [...positions].sort((left, right) => left - right) }
}

function splitWords(text: string): Word[] {
  const characters = Array.from(text)
  const words: Word[] = []
  let start = 0

  for (let index = 0; index <= characters.length; index += 1) {
    if (index < characters.length && !/[\s/-]/u.test(characters[index])) continue
    if (index > start) words.push({ text: characters.slice(start, index).join(''), start })
    start = index + 1
  }

  return words
}

function matchWord(word: string, term: string): FuzzyMatch | undefined {
  const characters = Array.from(word.toLocaleLowerCase())
  const query = Array.from(term)
  const positions: number[] = []
  let cursor = 0

  for (const character of query) {
    const position = characters.indexOf(character, cursor)
    if (position < 0) return undefined
    positions.push(position)
    cursor = position + 1
  }

  const consecutivePairs = positions.slice(1).filter((position, index) => position === positions[index] + 1).length
  const normalizedWord = characters.join('')
  const normalizedTerm = query.join('')
  const baseScore = normalizedWord === normalizedTerm
    ? 100
    : normalizedWord.startsWith(normalizedTerm)
      ? 80
      : 50

  return {
    score: baseScore + consecutivePairs * 3 - (positions.at(-1) ?? 0) * 0.15,
    positions,
  }
}
