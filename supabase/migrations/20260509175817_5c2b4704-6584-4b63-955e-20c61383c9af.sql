drop policy if exists delete_suggestions on public.suggestions;
create policy delete_suggestions on public.suggestions
for delete using (true);

drop policy if exists delete_bug_reports on public.bug_reports;
create policy delete_bug_reports on public.bug_reports
for delete using (true);