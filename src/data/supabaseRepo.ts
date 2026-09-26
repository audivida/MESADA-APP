import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Child, Execution, Family, Goal, LedgerEntry, NewTask, Task } from '../domain/types'
import { AppError, type NewChild, type Repo, type Session, type Snapshot } from './repo'
import { uid } from './localRepo'

const MESSAGES: Record<string, string> = {
  invalid_code_or_pin: 'Código da família ou PIN incorretos.',
  invalid_pin: 'O PIN precisa ter 4 números.',
  pin_in_use: 'Outro filho já usa esse PIN. Escolha outro.',
  photo_required: 'Essa tarefa precisa de uma foto.',
  already_submitted: 'Essa tarefa já foi enviada hoje.',
  already_reviewed: 'Essa tarefa já foi avaliada.',
  already_has_family: 'Sua conta já tem uma família.',
  forbidden: 'Você não tem permissão para fazer isso.',
  task_not_found: 'Tarefa não encontrada.',
  'Invalid login credentials': 'E-mail ou senha incorretos.',
  'User already registered': 'Já existe uma conta com esse e-mail.',
  'Email not confirmed': 'Confirme seu e-mail pelo link que enviamos e tente de novo.',
}

function fail(err: { message: string } | null): asserts err is null {
  if (!err) return
  const key = Object.keys(MESSAGES).find((k) => err.message.includes(k))
  throw new AppError(key ? MESSAGES[key] : `Algo deu errado: ${err.message}`)
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const toFamily = (r: any): Family => ({ id: r.id, name: r.name, pointValueCents: r.point_value_cents, code: r.code })
const toChild = (r: any): Child => ({ id: r.id, familyId: r.family_id, name: r.name, birthdate: r.birthdate, avatar: r.avatar })
const toTask = (r: any): Task => ({
  id: r.id,
  familyId: r.family_id,
  title: r.title,
  description: r.description,
  points: r.points,
  recurrence: r.recurrence,
  weekdays: r.weekdays ?? [],
  childIds: r.child_ids ?? [],
  requiresPhoto: r.requires_photo,
  active: r.active,
  createdAt: r.created_at,
})
const toLedger = (r: any): LedgerEntry => ({
  id: r.id,
  childId: r.child_id,
  familyId: r.family_id,
  points: r.points,
  kind: r.kind,
  refId: r.ref_id,
  note: r.note,
  createdAt: r.created_at,
})
const toGoal = (r: any): Goal => ({
  id: r.id,
  childId: r.child_id,
  familyId: r.family_id,
  title: r.title,
  targetPoints: r.target_points,
  bonusPoints: r.bonus_points,
  achievedAt: r.achieved_at,
})

export class SupabaseRepo implements Repo {
  readonly mode = 'supabase' as const
  private sb: SupabaseClient

  constructor(url: string, anonKey: string) {
    this.sb = createClient(url, anonKey)
  }

  async getSession(): Promise<Session | null> {
    const { data } = await this.sb.auth.getSession()
    const user = data.session?.user
    if (!user) return null
    if (user.is_anonymous) {
      const { data: s } = await this.sb.from('child_sessions').select('child_id, children(family_id)').maybeSingle()
      if (!s) return null
      return { role: 'child', childId: s.child_id, familyId: (s.children as any).family_id }
    }
    const { data: p, error } = await this.sb.from('parents').select('family_id, name').eq('user_id', user.id).maybeSingle()
    fail(error)
    return { role: 'parent', familyId: p?.family_id ?? null, name: p?.name ?? '' }
  }

  async signUpParent(name: string, email: string, password: string): Promise<Session> {
    const { data, error } = await this.sb.auth.signUp({ email, password, options: { data: { name } } })
    fail(error)
    if (!data.session) throw new AppError('Enviamos um link de confirmação para o seu e-mail. Confirme e depois entre.')
    return { role: 'parent', familyId: null, name }
  }

  async signInParent(email: string, password: string): Promise<Session> {
    const { error } = await this.sb.auth.signInWithPassword({ email, password })
    fail(error)
    const s = await this.getSession()
    if (!s) throw new AppError('Não foi possível entrar.')
    return s
  }

  async signInChild(code: string, pin: string): Promise<Session> {
    const { error } = await this.sb.auth.signInAnonymously()
    fail(error)
    const { error: e2 } = await this.sb.rpc('child_sign_in', { p_code: code, p_pin: pin })
    if (e2) {
      await this.sb.auth.signOut()
      fail(e2)
    }
    const s = await this.getSession()
    if (!s) throw new AppError('Não foi possível entrar.')
    return s
  }

  async signOut(): Promise<void> {
    await this.sb.auth.signOut()
  }

  async createFamily(name: string, pointValueCents: number): Promise<Session> {
    const { error } = await this.sb.rpc('create_family', { p_name: name, p_point_value_cents: pointValueCents })
    fail(error)
    return (await this.getSession())!
  }

  async updateFamily(name: string, pointValueCents: number): Promise<void> {
    const s = await this.getSession()
    const { error } = await this.sb.from('families').update({ name, point_value_cents: pointValueCents }).eq('id', s!.familyId!)
    fail(error)
  }

  async load(): Promise<Snapshot> {
    const [f, c, t, e, l, g] = await Promise.all([
      this.sb.from('families').select('*').single(),
      this.sb.from('children').select('id, family_id, name, birthdate, avatar').order('created_at'),
      this.sb.from('tasks').select('*').order('created_at'),
      this.sb.from('executions').select('*').order('created_at', { ascending: false }).limit(500),
      this.sb.from('ledger').select('*').order('created_at', { ascending: false }),
      this.sb.from('goals').select('*').order('created_at'),
    ])
    for (const r of [f, c, t, e, l, g]) fail(r.error)

    // Fotos ficam num bucket privado: gera links temporários.
    const paths = (e.data ?? []).map((r: any) => r.photo_path).filter(Boolean) as string[]
    const signed = new Map<string, string>()
    if (paths.length) {
      const { data } = await this.sb.storage.from('evidence').createSignedUrls(paths, 60 * 60)
      for (const s of data ?? []) if (s.path && s.signedUrl) signed.set(s.path, s.signedUrl)
    }
    const executions: Execution[] = (e.data ?? []).map((r: any) => ({
      id: r.id,
      taskId: r.task_id,
      childId: r.child_id,
      familyId: r.family_id,
      forDate: r.for_date,
      photoUrl: r.photo_path ? signed.get(r.photo_path) ?? null : null,
      status: r.status,
      parentNote: r.parent_note,
      createdAt: r.created_at,
      reviewedAt: r.reviewed_at,
    }))

    return {
      family: toFamily(f.data),
      children: (c.data ?? []).map(toChild),
      tasks: (t.data ?? []).map(toTask),
      executions,
      ledger: (l.data ?? []).map(toLedger),
      goals: (g.data ?? []).map(toGoal),
    }
  }

  async addChild(child: NewChild): Promise<void> {
    const { error } = await this.sb.rpc('add_child', {
      p_name: child.name,
      p_birthdate: child.birthdate,
      p_avatar: child.avatar,
      p_pin: child.pin,
    })
    fail(error)
  }

  async removeChild(childId: string): Promise<void> {
    const { error } = await this.sb.from('children').delete().eq('id', childId)
    fail(error)
  }

  async saveTask(task: NewTask, id?: string): Promise<void> {
    const row = {
      title: task.title,
      description: task.description,
      points: task.points,
      recurrence: task.recurrence,
      weekdays: task.weekdays,
      child_ids: task.childIds,
      requires_photo: task.requiresPhoto,
    }
    if (id) {
      fail((await this.sb.from('tasks').update(row).eq('id', id)).error)
    } else {
      const s = await this.getSession()
      fail((await this.sb.from('tasks').insert({ ...row, family_id: s!.familyId })).error)
    }
  }

  async archiveTask(id: string): Promise<void> {
    fail((await this.sb.from('tasks').update({ active: false }).eq('id', id)).error)
  }

  async submitExecution(taskId: string, childId: string, forDate: string, photo: Blob | null): Promise<void> {
    let path: string | null = null
    if (photo) {
      const s = await this.getSession()
      path = `${s!.familyId}/${childId}/${uid()}.jpg`
      const { error } = await this.sb.storage.from('evidence').upload(path, photo, { contentType: photo.type || 'image/jpeg' })
      fail(error)
    }
    const { error } = await this.sb.rpc('submit_execution', {
      p_task_id: taskId,
      p_child_id: childId,
      p_for_date: forDate,
      p_photo_path: path,
    })
    fail(error)
  }

  async reviewExecution(id: string, approve: boolean, note: string): Promise<void> {
    fail((await this.sb.rpc('review_execution', { p_execution_id: id, p_approve: approve, p_note: note })).error)
  }

  async addLedger(childId: string, points: number, kind: 'bonus' | 'penalty' | 'payout', note: string): Promise<void> {
    if (!Number.isFinite(points) || points <= 0) throw new AppError('Informe uma quantidade de pontos maior que zero.')
    const s = await this.getSession()
    const signed = kind === 'bonus' ? points : -points
    fail((await this.sb.from('ledger').insert({ child_id: childId, family_id: s!.familyId, points: signed, kind, note })).error)
  }

  async createGoal(childId: string, title: string, targetPoints: number, bonusPoints: number): Promise<void> {
    const s = await this.getSession()
    fail(
      (
        await this.sb
          .from('goals')
          .insert({ child_id: childId, family_id: s!.familyId, title, target_points: targetPoints, bonus_points: bonusPoints })
      ).error,
    )
  }

  async completeGoal(goalId: string): Promise<void> {
    fail((await this.sb.rpc('complete_goal', { p_goal_id: goalId })).error)
  }

  async removeGoal(goalId: string): Promise<void> {
    fail((await this.sb.from('goals').delete().eq('id', goalId)).error)
  }
}
