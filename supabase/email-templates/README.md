# Supabase Email Templates

Paste the HTML files in this folder into **Supabase Dashboard > Auth > Email Templates**.

Files:

- `signup-confirmation.html` for the **Confirm signup** template
- `reset-password.html` for the **Reset password** template

These templates point to the safe click-through pages at:

- `/auth/confirm-link`
- `/auth/reset-link`

That extra page click avoids automated email scanners consuming the verification token before the user opens it.
