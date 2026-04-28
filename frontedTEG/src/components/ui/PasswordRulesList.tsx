import { Check, X } from 'lucide-react'

import { PASSWORD_RULES } from '../../utils/passwordValidation'

export function PasswordRulesList({ pw }: { pw: string }) {
  return (
    <ul className="space-y-1 rounded-lg bg-default-50 px-3 py-2 text-xs">
      {PASSWORD_RULES.map((rule) => {
        const ok = rule.test(pw)
        return (
          <li
            key={rule.key}
            className={`flex items-center gap-2 ${ok ? 'text-success-600' : 'text-default-500'}`}
          >
            {ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
            <span>{rule.label}</span>
          </li>
        )
      })}
    </ul>
  )
}
