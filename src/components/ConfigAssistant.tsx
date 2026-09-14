import { useEffect, useRef, useState } from "react";
import { Bot, Send, Square, X, Check, Pencil, MessageCircle, MessagesSquare, FilePenLine, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { ElectronScannedConfig } from "@/utils/electronFolderScanner";
import JSON5 from "json5";

type Message = { role: 'user' | 'assistant'; content: string };
type Proposal = { fileId: string; explanation: string; content: string; before: string };
type AssistantMode = 'chat' | 'edit';
type Activity = 'reading' | 'thinking' | 'preparing' | null;
interface Props {
  modName: string;
  configs: ElectronScannedConfig[];
  activeIndex: number;
  rawText: string;
  secondaryIndex: number | null;
  secondaryText: string;
  onApply: (text: string, before: string) => Promise<void>;
}
export function ConfigAssistant({ modName, configs, activeIndex, rawText, secondaryIndex, secondaryText, onApply }: Props) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<AssistantMode>('chat');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [reasoning, setReasoning] = useState('');
  const [error, setError] = useState('');
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [review, setReview] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activity, setActivity] = useState<Activity>(null);
  const controller = useRef<AbortController | null>(null);
  const alive = useRef(true);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; controller.current?.abort(); }; }, []);
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }); }, [messages, reasoning, error]);

  const send = async () => {
    if (!input.trim() || busy) return;
    const next: Message[] = [...messages, { role: 'user', content: input.trim() }];
    setMessages(next); setInput(''); setError(''); setReasoning(''); setBusy(true); setProposal(null); setActivity('reading');
    const abort = new AbortController(); controller.current = abort;
    const before = rawText;
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw new Error('Sign in to use the assistant.');
      const files = await Promise.all(configs.map(async (config, index) => ({
        id: String(index), name: config.fileName,
        content: index === activeIndex ? before : index === secondaryIndex ? secondaryText : await (await config.fileHandle.getFile()).text(),
      })));
      if (abort.signal.aborted) return;
      setActivity('thinking');
      const body = JSON.stringify({ mode, modName, activeFileId: String(activeIndex), files, messages: next.slice(-30) });
      if (body.length > 240000) throw new Error('This mod is too large for one AI request. No files were sent.');
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/config-assistant`, {
        method: 'POST', signal: abort.signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY }, body,
      });
      if (!response.ok) { const problem = await response.json().catch(() => ({})); throw new Error(problem.message || problem.error || `Assistant unavailable (${response.status})`); }
      if (!response.body) throw new Error('No response received.');
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = ''; let received = false;
      const consume = (line: string) => {
        if (!line.trim() || !alive.current) return;
        const event = JSON.parse(line);
        if (event.type === 'error') throw new Error(event.message);
        if (event.type === 'reasoning') { setActivity(mode === 'edit' ? 'preparing' : 'thinking'); setReasoning(value => value + event.text); }
        if (event.type === 'result') {
          received = true;
          setMessages(value => [...value, { role: 'assistant', content: event.answer || 'No answer returned. No files were changed.' }]);
          if (event.proposal) {
            if (event.proposal.fileId !== String(activeIndex) || typeof event.proposal.content !== 'string') throw new Error('Suggestion does not match the active file.');
            JSON5.parse(event.proposal.content);
            setProposal({ ...event.proposal, before }); setEditing(false); setReview(true);
          }
        }
      };
      while (true) { const { done, value } = await reader.read(); if (done) break; buffer += decoder.decode(value, { stream: true }); const lines = buffer.split('\n'); buffer = lines.pop() || ''; for (const line of lines) consume(line); }
      consume(buffer + decoder.decode());
      if (!received) throw new Error('The response ended without an answer. No files were changed.');
    } catch (e) { if (alive.current) setError(abort.signal.aborted ? 'Request stopped. No files were changed.' : e instanceof Error ? e.message : 'Assistant request failed.'); }
    finally { if (alive.current) { setBusy(false); setActivity(null); } }
  };
  const confirm = async () => {
    if (!proposal || saving) return;
    setSaving(true); setError('');
    try {
      JSON5.parse(proposal.content);
      if (rawText !== proposal.before) throw new Error('The file changed since this suggestion. Ask for a new suggestion to avoid overwriting your edits.');
      await onApply(proposal.content, proposal.before);
      setMessages(value => [...value, { role: 'user', content: 'I confirmed and saved the reviewed change.' }]);
      setReview(false); setProposal(null);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save the change.'); }
    finally { setSaving(false); }
  };
  return <>
    <div className="absolute bottom-12 right-4 z-30 flex max-w-[calc(100%-2rem)] flex-col items-end gap-3">
      {open && <section aria-label="Config assistant" className="flex h-[min(600px,70vh)] w-[410px] max-w-full flex-col overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-xl">
        <header className="border-b border-border bg-muted/30 p-3">
          <div className="flex items-center gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15"><Bot className="h-5 w-5 text-primary"/></span><div className="min-w-0 flex-1"><h2 className="flex items-center gap-1.5 text-sm font-semibold">Config assistant <Sparkles className="h-3.5 w-3.5 text-primary"/></h2><p className="truncate text-xs text-muted-foreground">{modName} · {configs.length} files</p></div><Button size="icon" variant="ghost" className="rounded-full" aria-label="Close assistant" onClick={() => setOpen(false)}><X className="h-4 w-4"/></Button></div>
          <div className="mt-3 grid grid-cols-2 rounded-xl bg-muted p-1" aria-label="Assistant mode">
            <Button type="button" size="sm" variant={mode === 'chat' ? 'secondary' : 'ghost'} className="h-8 rounded-lg" aria-pressed={mode === 'chat'} disabled={busy} onClick={() => setMode('chat')}><MessagesSquare className="h-4 w-4"/>Chat</Button>
            <Button type="button" size="sm" variant={mode === 'edit' ? 'secondary' : 'ghost'} className="h-8 rounded-lg" aria-pressed={mode === 'edit'} disabled={busy} onClick={() => setMode('edit')}><FilePenLine className="h-4 w-4"/>Edit</Button>
          </div>
        </header>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          {!messages.length && <div className="mr-8 rounded-2xl rounded-tl-md border border-border bg-background/70 p-4 text-sm text-muted-foreground">{mode === 'chat' ? `Ask anything about ${configs[activeIndex]?.fileName}. I can explain settings without changing the file.` : `Tell me what to change in ${configs[activeIndex]?.fileName}. You will review every suggestion before it is saved.`}<p className="mt-2 text-xs">This mod’s config files are sent through Lovable AI. AI credits apply.</p></div>}
          {messages.map((message, i) => <div key={i} className={message.role === 'user' ? 'ml-8 rounded-2xl rounded-tr-md bg-primary p-3 text-sm text-primary-foreground shadow-sm whitespace-pre-wrap break-words' : 'mr-8 rounded-2xl rounded-tl-md border border-border bg-background/70 p-3 text-sm shadow-sm whitespace-pre-wrap break-words'}><p className={message.role === 'user' ? 'mb-1 text-xs font-semibold text-primary-foreground/75' : 'mb-1 text-xs font-semibold text-muted-foreground'}>{message.role === 'user' ? 'You' : 'Assistant'}</p>{message.content}</div>)}
          {reasoning && <details className="text-xs text-muted-foreground"><summary>Thinking summary</summary><p className="whitespace-pre-wrap">{reasoning}</p></details>}
          {busy && <div className="mr-12 flex w-fit items-center gap-2 rounded-2xl rounded-tl-md border border-border bg-background/70 px-4 py-3 text-sm text-muted-foreground shadow-sm" role="status" aria-live="polite"><span>{activity === 'reading' ? 'Reading config' : activity === 'preparing' ? 'Preparing suggestion' : 'Thinking'}</span><span className="assistant-typing-dots" aria-hidden="true"><i/><i/><i/></span></div>}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          {proposal && <Button variant="outline" onClick={() => setReview(true)}>Review suggested change</Button>}<div ref={end}/>
        </div>
        <form className="flex items-end gap-2 border-t border-border bg-muted/20 p-3" onSubmit={e => { e.preventDefault(); void send(); }}>
          <Textarea aria-label="Message assistant" placeholder={mode === 'chat' ? 'Ask about this mod…' : 'Describe the change…'} value={input} onChange={e => setInput(e.target.value)} maxLength={8000} className="min-h-16 resize-none rounded-2xl bg-background" disabled={busy}/>
          {busy ? <Button type="button" size="icon" variant="outline" className="shrink-0 rounded-full" aria-label="Stop generation" onClick={() => controller.current?.abort()}><Square className="h-4 w-4"/></Button> : <Button type="submit" size="icon" className="shrink-0 rounded-full" aria-label="Send message" disabled={!input.trim()}><Send className="h-4 w-4"/></Button>}
        </form>
      </section>}
      <Button size="icon" className="assistant-launcher h-14 w-14 rounded-full border-4 border-background shadow-xl" aria-label={open ? 'Hide AI assistant' : 'Open AI assistant'} onClick={() => setOpen(!open)}><MessageCircle className="h-6 w-6"/></Button>
    </div>
    <Dialog open={review} onOpenChange={value => { if (!saving) setReview(value); }}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Review config change</DialogTitle><DialogDescription>{configs[activeIndex]?.fileName} — {proposal?.explanation}</DialogDescription></DialogHeader>
        <div className="grid min-w-0 gap-4 md:grid-cols-2"><div className="min-w-0"><h3 className="mb-2 text-sm font-medium">Before</h3><pre className="h-72 overflow-auto rounded-md border border-border bg-muted p-3 text-xs">{proposal?.before}</pre></div><div className="min-w-0"><h3 className="mb-2 text-sm font-medium">{editing ? 'Edit suggestion' : 'Suggested'}</h3><Textarea aria-label="Suggested config" readOnly={!editing || saving} value={proposal?.content || ''} onChange={e => setProposal(value => value ? { ...value, content: e.target.value } : null)} className="h-72 font-mono text-xs"/></div></div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex flex-wrap justify-end gap-2"><Button variant="ghost" disabled={saving} onClick={() => setReview(false)}>Cancel</Button><Button variant="destructive" disabled={saving} onClick={() => { setProposal(null); setReview(false); setMessages(value => [...value, { role: 'user', content: 'I denied that suggestion. Do not apply it.' }]); }}>Deny</Button><Button variant="outline" disabled={saving} onClick={() => setEditing(true)}><Pencil className="mr-2 h-4 w-4"/>Make Edits</Button><Button disabled={saving || !proposal} onClick={() => void confirm()}><Check className="mr-2 h-4 w-4"/>{saving ? 'Saving…' : 'Confirm & Save'}</Button></div>
      </DialogContent>
    </Dialog>
  </>;
}
