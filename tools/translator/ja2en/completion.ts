import fs from 'fs'
import consola from 'consola'
import dotenv from 'dotenv'
import { INPUT, OUT } from './constant'

export const completion = async () => {
  if (!fs.existsSync('.env')) {
    consola.error('.env not found!')
    return
  }

  dotenv.config()
  if (!process.env.OPEN_AI_API_KEY) {
    consola.error('OPEN_AI_API_KEY not found!')
    return
  }

  const createPrompt = (content: string) =>
    `以下の日本語の文章を英語に翻訳してください。\n\n${content}`

  // check input.md content
  const input = fs.readFileSync(INPUT, 'utf-8')
  if (!input) {
    consola.error('input.md is empty!')
    return
  }

  // print loader animation
  const states = ['|', '/', '-', '\\']
  let i = 0
  const loader = setInterval(() => {
    process.stdout.write(`\r${states[i++ % states.length]} Translating...`)
  }, 100)
  const res = await post(createPrompt(input), process.env.OPEN_AI_API_KEY!)
  clearInterval(loader)
  if (!res) {
    consola.error('Translation failed!')
    return
  }

  fs.writeFileSync(OUT, res)
  consola.log('')
  consola.success(`Translation completed! See ${OUT}`)
}

interface ChatGPTResponse {
  id: string
  object: string
  created: number
  model: string
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
  choices: Choice[]
}

interface ChoiceBase {
  finish_reason: string
  index: number
}
interface Choice extends ChoiceBase {
  message?: { role: string; content: string }
}

const post = async (prompt: string, apiKey: string): Promise<string> => {
  return await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
    }),
  })
    .then(res => res.json())
    .then(
      (res: ChatGPTResponse) => res.choices[0]?.message?.content.trim() ?? '',
    )
}
