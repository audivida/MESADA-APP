import { LocalRepo } from './localRepo'
import type { Repo } from './repo'
import { SupabaseRepo } from './supabaseRepo'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** Com Supabase configurado usa o servidor; senão, tudo fica no navegador. */
export const repo: Repo = url && key ? new SupabaseRepo(url, key) : new LocalRepo()
export const localRepo = repo instanceof LocalRepo ? repo : null
