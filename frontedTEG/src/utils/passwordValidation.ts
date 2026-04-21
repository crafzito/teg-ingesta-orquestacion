export type PasswordCheck = { valid: boolean; errors: string[] }

export type PasswordRule = {
  key: 'length' | 'uppercase' | 'lowercase' | 'number'
  label: string
  test: (pw: string) => boolean
}

export const PASSWORD_RULES: PasswordRule[] = [
  {
    key: 'length',
    label: 'Al menos 8 caracteres',
    test: (pw) => pw.length >= 8,
  },
  {
    key: 'uppercase',
    label: 'Al menos una mayuscula',
    test: (pw) => /[A-Z]/.test(pw),
  },
  {
    key: 'lowercase',
    label: 'Al menos una minuscula',
    test: (pw) => /[a-z]/.test(pw),
  },
  {
    key: 'number',
    label: 'Al menos un numero',
    test: (pw) => /\d/.test(pw),
  },
]

export function validatePassword(pw: string): PasswordCheck {
  const errors: string[] = []
  if (pw.length < 8) errors.push('La contrasena debe tener al menos 8 caracteres')
  if (!/[A-Z]/.test(pw)) errors.push('La contrasena debe tener al menos una mayuscula')
  if (!/[a-z]/.test(pw)) errors.push('La contrasena debe tener al menos una minuscula')
  if (!/\d/.test(pw)) errors.push('La contrasena debe tener al menos un numero')

  return { valid: errors.length === 0, errors }
}
