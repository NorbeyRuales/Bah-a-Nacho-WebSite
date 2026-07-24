import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.110.8'

type UserStatus = 'active' | 'inactive'
type AdminAction = 'invite' | 'update' | 'archive' | 'restore' | 'send-password-reset'

type AdminRequest = {
  action?: AdminAction
  userId?: unknown
  firstName?: unknown
  lastName?: unknown
  email?: unknown
  roleId?: unknown
  status?: unknown
}

type ValidUserInput = {
  userId?: string
  firstName: string
  lastName: string
  email: string
  roleId: string
  status: UserStatus
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const PASSWORD_RESET_REDIRECT_URL = Deno.env.get('PASSWORD_RESET_REDIRECT_URL')
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const MAX_BODY_BYTES = 16_384

const baseCorsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
  'Vary': 'Origin',
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code: string,
  ) {
    super(message)
  }
}

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...baseCorsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  })
}

function requiredString(value: unknown, fieldName: string) {
  if (typeof value !== 'string') {
    throw new HttpError(400, `${fieldName} es obligatorio.`, 'invalid_input')
  }
  return value.trim()
}

function optionalUserId(value: unknown) {
  const userId = requiredString(value, 'El usuario')
  if (!UUID_PATTERN.test(userId)) {
    throw new HttpError(400, 'El identificador del usuario no es válido.', 'invalid_user_id')
  }
  return userId
}

function validateUserInput(body: AdminRequest, requireUserId: boolean): ValidUserInput {
  const firstName = requiredString(body.firstName, 'El nombre')
  const lastName = requiredString(body.lastName, 'El apellido')
  const email = requiredString(body.email, 'El correo').toLowerCase()
  const roleId = requiredString(body.roleId, 'El rol')
  const status = body.status

  if (firstName.length < 2 || firstName.length > 100) {
    throw new HttpError(400, 'El nombre debe contener entre 2 y 100 caracteres.', 'invalid_first_name')
  }
  if (lastName.length > 100) {
    throw new HttpError(400, 'El apellido no puede superar 100 caracteres.', 'invalid_last_name')
  }
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    throw new HttpError(400, 'Ingresa un correo electrónico válido.', 'invalid_email')
  }
  if (!UUID_PATTERN.test(roleId)) {
    throw new HttpError(400, 'Selecciona un rol válido.', 'invalid_role')
  }
  if (status !== 'active' && status !== 'inactive') {
    throw new HttpError(400, 'Selecciona un estado válido.', 'invalid_status')
  }

  return {
    userId: requireUserId ? optionalUserId(body.userId) : undefined,
    firstName,
    lastName,
    email,
    roleId,
    status,
  }
}

async function assertAssignableRole(serviceClient: SupabaseClient, roleId: string) {
  const { data, error } = await serviceClient
    .from('roles')
    .select('id, code')
    .eq('id', roleId)
    .eq('is_active', true)
    .maybeSingle()

  if (error) throw new HttpError(500, 'No fue posible validar el rol.', 'role_validation_failed')
  if (!data) throw new HttpError(400, 'El rol seleccionado no está disponible.', 'invalid_role')
  return data
}

async function saveProfile(userClient: SupabaseClient, input: ValidUserInput & { userId: string }) {
  const { error } = await userClient.rpc('admin_save_user_profile', {
    target_user_id: input.userId,
    target_first_name: input.firstName,
    target_last_name: input.lastName,
    target_role_id: input.roleId,
    target_status: input.status,
  })

  if (!error) return

  if (error.code === '42501') {
    throw new HttpError(403, error.message, 'forbidden')
  }
  if (error.code === '23514') {
    throw new HttpError(409, error.message, 'last_administrator')
  }
  if (error.code === 'P0002') {
    throw new HttpError(404, error.message, 'user_not_found')
  }
  if (error.code === '55000') {
    throw new HttpError(409, error.message, 'user_archived')
  }
  throw new HttpError(400, 'No fue posible guardar los datos del usuario.', 'profile_update_failed')
}

async function handleInvite(
  body: AdminRequest,
  userClient: SupabaseClient,
  serviceClient: SupabaseClient,
) {
  const input = validateUserInput(body, false)
  const role = await assertAssignableRole(serviceClient, input.roleId)

  const { data, error } = await serviceClient.auth.admin.inviteUserByEmail(input.email, {
    data: {
      first_name: input.firstName,
      last_name: input.lastName,
      provision_client_profile: role.code === 'customer',
    },
  })

  if (error || !data.user) {
    const duplicate = error?.message.toLowerCase().includes('already')
    throw new HttpError(
      duplicate ? 409 : 400,
      duplicate
        ? 'Ya existe una cuenta con ese correo.'
        : 'No fue posible crear la invitación. Verifica la configuración de correo de Supabase.',
      duplicate ? 'email_exists' : 'invite_failed',
    )
  }

  try {
    await saveProfile(userClient, { ...input, userId: data.user.id })
  } catch (profileError) {
    await serviceClient.auth.admin.deleteUser(data.user.id)
    throw profileError
  }

  return jsonResponse(201, {
    ok: true,
    userId: data.user.id,
    message: 'Usuario creado. Supabase envió la invitación para establecer su contraseña.',
  })
}

async function handleUpdate(
  body: AdminRequest,
  userClient: SupabaseClient,
  serviceClient: SupabaseClient,
) {
  const input = validateUserInput(body, true)
  const userId = input.userId as string
  await assertAssignableRole(serviceClient, input.roleId)

  const { data: previousUserData, error: previousUserError } =
    await serviceClient.auth.admin.getUserById(userId)

  if (previousUserError || !previousUserData.user) {
    throw new HttpError(404, 'La identidad de Auth no existe.', 'user_not_found')
  }

  const previousUser = previousUserData.user
  const previousEmail = previousUser.email
  if (!previousEmail) {
    throw new HttpError(409, 'La identidad no tiene un correo administrable.', 'missing_email')
  }

  const { error: authUpdateError } = await serviceClient.auth.admin.updateUserById(userId, {
    email: input.email,
    user_metadata: {
      ...previousUser.user_metadata,
      first_name: input.firstName,
      last_name: input.lastName,
    },
  })

  if (authUpdateError) {
    const duplicate = authUpdateError.message.toLowerCase().includes('already')
    throw new HttpError(
      duplicate ? 409 : 400,
      duplicate ? 'Ya existe una cuenta con ese correo.' : 'No fue posible actualizar la identidad.',
      duplicate ? 'email_exists' : 'auth_update_failed',
    )
  }

  try {
    await saveProfile(userClient, { ...input, userId })
  } catch (profileError) {
    await serviceClient.auth.admin.updateUserById(userId, {
      email: previousEmail,
      user_metadata: previousUser.user_metadata,
    })
    throw profileError
  }

  return jsonResponse(200, { ok: true, userId, message: 'Usuario actualizado correctamente.' })
}

async function handleProfileAction(
  action: 'archive' | 'restore',
  body: AdminRequest,
  userClient: SupabaseClient,
) {
  const userId = optionalUserId(body.userId)
  const rpcName = action === 'archive' ? 'admin_archive_user' : 'admin_restore_user'
  const { error } = await userClient.rpc(rpcName, { target_user_id: userId })

  if (error) {
    if (error.code === '42501') throw new HttpError(403, error.message, 'forbidden')
    if (error.code === '23514') throw new HttpError(409, error.message, 'last_administrator')
    if (error.code === 'P0002') throw new HttpError(404, error.message, 'user_not_found')
    throw new HttpError(400, `No fue posible ${action === 'archive' ? 'eliminar' : 'restaurar'} el usuario.`, 'profile_action_failed')
  }

  return jsonResponse(200, {
    ok: true,
    userId,
    message: action === 'archive'
      ? 'Usuario eliminado de forma segura. Puedes restaurarlo desde el filtro Archivados.'
      : 'Usuario restaurado y activado.',
  })
}

async function handlePasswordReset(body: AdminRequest, serviceClient: SupabaseClient) {
  const userId = optionalUserId(body.userId)
  const { data, error } = await serviceClient.auth.admin.getUserById(userId)

  if (error || !data.user?.email) {
    throw new HttpError(404, 'No se encontró una identidad con correo.', 'user_not_found')
  }

  const options = PASSWORD_RESET_REDIRECT_URL
    ? { redirectTo: PASSWORD_RESET_REDIRECT_URL }
    : undefined
  const { error: resetError } = await serviceClient.auth.resetPasswordForEmail(
    data.user.email,
    options,
  )

  if (resetError) {
    throw new HttpError(400, 'No fue posible enviar el correo de restablecimiento.', 'reset_failed')
  }

  return jsonResponse(200, {
    ok: true,
    userId,
    message: 'Supabase envió el correo para restablecer la contraseña.',
  })
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: baseCorsHeaders })
  }
  if (request.method !== 'POST') {
    return jsonResponse(405, { ok: false, code: 'method_not_allowed', message: 'Método no permitido.' })
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new HttpError(500, 'La función no tiene la configuración requerida.', 'server_misconfigured')
    }

    const declaredLength = Number(request.headers.get('content-length') ?? '0')
    if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
      throw new HttpError(413, 'La solicitud es demasiado grande.', 'payload_too_large')
    }

    const authorization = request.headers.get('authorization')
    const token = authorization?.replace(/^Bearer\s+/i, '')
    if (!authorization || !token || token === authorization) {
      throw new HttpError(401, 'Se requiere una sesión autenticada.', 'unauthorized')
    }

    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: identity, error: identityError } = await serviceClient.auth.getUser(token)
    if (identityError || !identity.user) {
      throw new HttpError(401, 'La sesión no es válida o expiró.', 'unauthorized')
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: canManage, error: permissionError } = await userClient.rpc('has_permission', {
      required_permission: 'users.manage',
    })
    if (permissionError || canManage !== true) {
      throw new HttpError(403, 'Tu rol no tiene permiso para administrar usuarios.', 'forbidden')
    }

    let body: AdminRequest
    try {
      body = await request.json()
    } catch {
      throw new HttpError(400, 'La solicitud JSON no es válida.', 'invalid_json')
    }

    switch (body.action) {
      case 'invite':
        return await handleInvite(body, userClient, serviceClient)
      case 'update':
        return await handleUpdate(body, userClient, serviceClient)
      case 'archive':
      case 'restore':
        return await handleProfileAction(body.action, body, userClient)
      case 'send-password-reset':
        return await handlePasswordReset(body, serviceClient)
      default:
        throw new HttpError(400, 'La acción solicitada no es válida.', 'invalid_action')
    }
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonResponse(error.status, { ok: false, code: error.code, message: error.message })
    }

    console.error('admin-users unexpected error', error)
    return jsonResponse(500, {
      ok: false,
      code: 'internal_error',
      message: 'Ocurrió un error interno al administrar el usuario.',
    })
  }
})
