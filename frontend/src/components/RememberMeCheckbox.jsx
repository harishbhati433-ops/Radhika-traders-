export const RememberMeCheckbox = ({ checked, onChange, testId = "remember-me" }) => (
  <label className="flex cursor-pointer items-start gap-2.5 text-sm text-slate-600 dark:text-slate-300" data-testid={`${testId}-label`}>
    <input
      type="checkbox"
      data-testid={testId}
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 accent-red-600"
    />
    <span>Login details save rakho (baar-baar na mange)</span>
  </label>
);
