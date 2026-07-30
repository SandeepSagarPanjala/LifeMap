For all the changes in Staged, create branch, commit all changes
check lint, typecheck and tests
create Pr and attach issues

and monitor copilot review after copilot review is completed(make sure it is completed, Copilot does not run in Checks block it gives text something like this Copilot started reviewing on behalf of SandeepSagarPanjala 5 minutes ago and when it is completed Copilot AI reviewed 3 minutes ago) and copilot review kept any review comments fix them only if they are worth after fixing them push the changes and again wait for copilot review comments again if copilot kept any review comments again do the same if they are worth fixing it repeat this process until there are no worth fixing review comments

After all these merge the PR

After it is merged switch to main branch pull latest code then run pnpm ios:beta
