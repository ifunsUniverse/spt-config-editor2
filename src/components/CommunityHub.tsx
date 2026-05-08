import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Plus, ThumbsUp, Bug, Lightbulb, Loader2, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface Suggestion {
  id: string;
  title: string;
  description: string;
  author_name: string;
  votes: number;
  created_at: string;
}

interface BugReport {
  id: string;
  title: string;
  description: string;
  steps_to_reproduce: string | null;
  severity: string;
  author_name: string;
  status: string;
  created_at: string;
}

interface CommunityHubProps {
  onBack: () => void;
}

const POSTIT_COLORS = [
  "bg-yellow-100 border-yellow-400 dark:bg-yellow-900/30 dark:border-yellow-600",
  "bg-pink-100 border-pink-400 dark:bg-pink-900/30 dark:border-pink-600",
  "bg-sky-100 border-sky-400 dark:bg-sky-900/30 dark:border-sky-600",
  "bg-emerald-100 border-emerald-400 dark:bg-emerald-900/30 dark:border-emerald-600",
  "bg-violet-100 border-violet-400 dark:bg-violet-900/30 dark:border-violet-600",
  "bg-orange-100 border-orange-400 dark:bg-orange-900/30 dark:border-orange-600",
];

const ROTATIONS = ["rotate-1", "-rotate-1", "rotate-2", "-rotate-2", "rotate-0", "rotate-0"];

const SEVERITY_BADGES: Record<string, string> = {
  low: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  critical: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

const STATUS_BADGES: Record<string, string> = {
  open: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  "in-progress": "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  resolved: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
};

function getErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message ?? "Unknown error");
  }
  return "Unknown error";
}

function getVotedSet(): Set<string> {
  try {
    const raw = localStorage.getItem("spt-voted-suggestions");
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveVotedSet(ids: Set<string>) {
  localStorage.setItem("spt-voted-suggestions", JSON.stringify([...ids]));
}

export const CommunityHub = ({ onBack }: CommunityHubProps) => {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [bugReports, setBugReports] = useState<BugReport[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);
  const [loadingBugs, setLoadingBugs] = useState(true);
  const [votedIds, setVotedIds] = useState<Set<string>>(getVotedSet);
  const [votingId, setVotingId] = useState<string | null>(null);
  const [expandedBugId, setExpandedBugId] = useState<string | null>(null);

  // New Suggestion dialog
  const [showSuggestionForm, setShowSuggestionForm] = useState(false);
  const [suggTitle, setSuggTitle] = useState("");
  const [suggDesc, setSuggDesc] = useState("");
  const [submittingSugg, setSubmittingSugg] = useState(false);

  // New Bug Report dialog
  const [showBugForm, setShowBugForm] = useState(false);
  const [bugTitle, setBugTitle] = useState("");
  const [bugDesc, setBugDesc] = useState("");
  const [bugSteps, setBugSteps] = useState("");
  const [bugSeverity, setBugSeverity] = useState("medium");
  const [submittingBug, setSubmittingBug] = useState(false);

  const fetchSuggestions = useCallback(async () => {
    setLoadingSuggestions(true);
    try {
      const { data, error } = await (supabase as any)
        .from("suggestions")
        .select("*")
        .order("votes", { ascending: false });
      if (error) throw error;
      setSuggestions(data ?? []);
    } catch (error) {
      console.error("Failed to load suggestions:", error);
      toast.error(`Failed to load suggestions: ${getErrorMessage(error)}`);
    } finally {
      setLoadingSuggestions(false);
    }
  }, []);

  const fetchBugReports = useCallback(async () => {
    setLoadingBugs(true);
    try {
      const { data, error } = await (supabase as any)
        .from("bug_reports")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setBugReports(data ?? []);
    } catch (error) {
      console.error("Failed to load bug reports:", error);
      toast.error(`Failed to load bug reports: ${getErrorMessage(error)}`);
    } finally {
      setLoadingBugs(false);
    }
  }, []);

  useEffect(() => {
    fetchSuggestions();
    fetchBugReports();
  }, [fetchSuggestions, fetchBugReports]);

  const handleVote = async (suggestion: Suggestion) => {
    if (votedIds.has(suggestion.id) || votingId) return;
    setVotingId(suggestion.id);
    try {
      const { error } = await (supabase as any)
        .from("suggestions")
        .update({ votes: suggestion.votes + 1 })
        .eq("id", suggestion.id);
      if (error) throw error;
      const next = new Set(votedIds);
      next.add(suggestion.id);
      setVotedIds(next);
      saveVotedSet(next);
      setSuggestions(prev =>
        prev
          .map(s => s.id === suggestion.id ? { ...s, votes: s.votes + 1 } : s)
          .sort((a, b) => b.votes - a.votes)
      );
    } catch (error) {
      console.error("Failed to upvote:", error);
      toast.error(`Failed to upvote: ${getErrorMessage(error)}`);
    } finally {
      setVotingId(null);
    }
  };

  const handleSubmitSuggestion = async () => {
    if (!suggTitle.trim() || !suggDesc.trim()) {
      toast.error("Please fill in all fields");
      return;
    }
    setSubmittingSugg(true);
    try {
      const { data, error } = await (supabase as any)
        .from("suggestions")
        .insert({ title: suggTitle.trim(), description: suggDesc.trim(), author_name: "Anonymous", votes: 0 })
        .select()
        .single();
      if (error) throw error;
      setSuggestions(prev => [data, ...prev]);
      setShowSuggestionForm(false);
      setSuggTitle("");
      setSuggDesc("");
      toast.success("Suggestion posted!");
    } catch (error) {
      console.error("Failed to post suggestion:", error);
      toast.error(`Failed to post suggestion: ${getErrorMessage(error)}`);
    } finally {
      setSubmittingSugg(false);
    }
  };

  const handleSubmitBug = async () => {
    if (!bugTitle.trim() || !bugDesc.trim()) {
      toast.error("Please fill in all fields");
      return;
    }
    setSubmittingBug(true);
    try {
      const { data, error } = await (supabase as any)
        .from("bug_reports")
        .insert({
          title: bugTitle.trim(),
          description: bugDesc.trim(),
          steps_to_reproduce: bugSteps.trim() || null,
          severity: bugSeverity,
          author_name: "Anonymous",
          status: "open",
        })
        .select()
        .single();
      if (error) throw error;
      setBugReports(prev => [data, ...prev]);
      setShowBugForm(false);
      setBugTitle("");
      setBugDesc("");
      setBugSteps("");
      setBugSeverity("medium");
      toast.success("Bug report submitted!");
    } catch (error) {
      console.error("Failed to submit bug report:", error);
      toast.error(`Failed to submit bug report: ${getErrorMessage(error)}`);
    } finally {
      setSubmittingBug(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-2 text-muted-foreground">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-foreground">Community Board</h1>
          <p className="text-xs text-muted-foreground">Share ideas and report issues</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="suggestions" className="flex flex-col flex-1 min-h-0">
        <div className="px-4 pt-3 shrink-0">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="suggestions" className="gap-2 flex-1 sm:flex-none">
              <Lightbulb className="w-4 h-4" />
              Feature Suggestions
              {suggestions.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1">
                  {suggestions.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="bugs" className="gap-2 flex-1 sm:flex-none">
              <Bug className="w-4 h-4" />
              Bug Reports
              {bugReports.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1">
                  {bugReports.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ── Suggestions Tab ── */}
        <TabsContent value="suggestions" className="flex-1 min-h-0 flex flex-col mt-0 pt-3">
          <div className="flex items-center justify-between px-4 pb-3 shrink-0">
            <p className="text-xs text-muted-foreground">
              Upvote ideas you love — top ideas get implemented first
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={fetchSuggestions} className="gap-1.5 h-8">
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh
              </Button>
              <Button size="sm" onClick={() => setShowSuggestionForm(true)} className="gap-1.5 h-8">
                <Plus className="w-3.5 h-3.5" />
                New Suggestion
              </Button>
            </div>
          </div>

          <ScrollArea className="flex-1 px-4">
            {loadingSuggestions ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : suggestions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                <Lightbulb className="w-10 h-10 mb-3 opacity-30" />
                <p className="text-sm font-medium">No suggestions yet</p>
                <p className="text-xs mt-1">Be the first to share an idea!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 pb-6 pt-2">
                {suggestions.map((s, i) => {
                  const color = POSTIT_COLORS[i % POSTIT_COLORS.length];
                  const rotation = ROTATIONS[i % ROTATIONS.length];
                  const hasVoted = votedIds.has(s.id);
                  const isVoting = votingId === s.id;
                  return (
                    <div
                      key={s.id}
                      className={`relative border-2 rounded-sm p-4 shadow-md hover:shadow-xl transition-all duration-200 ${color} ${rotation} hover:rotate-0 hover:scale-[1.02]`}
                    >
                      {/* Pin decoration */}
                      <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-red-500 shadow-md border-2 border-red-700 z-10" />
                      <div className="pt-2 flex flex-col h-full">
                        <h3 className="font-bold text-sm text-foreground/90 leading-tight mb-2 line-clamp-2">
                          {s.title}
                        </h3>
                        <p className="text-xs text-foreground/70 leading-relaxed mb-3 line-clamp-4 flex-1">
                          {s.description}
                        </p>
                        <div className="flex items-end justify-between mt-auto pt-2 border-t border-black/10 dark:border-white/10">
                          <div className="text-[10px] text-foreground/50 leading-tight">
                            <div className="font-medium">{s.author_name}</div>
                            <div>{formatDistanceToNow(new Date(s.created_at), { addSuffix: true })}</div>
                          </div>
                          <button
                            onClick={() => handleVote(s)}
                            disabled={hasVoted || !!votingId}
                            title={hasVoted ? "Already upvoted" : "Upvote this idea"}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                              hasVoted
                                ? "bg-primary/20 text-primary cursor-default"
                                : "hover:bg-black/10 dark:hover:bg-white/10 text-foreground/60 hover:text-foreground"
                            }`}
                          >
                            {isVoting ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <ThumbsUp className={`w-3 h-3 ${hasVoted ? "fill-primary" : ""}`} />
                            )}
                            <span>{s.votes}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        {/* ── Bug Reports Tab ── */}
        <TabsContent value="bugs" className="flex-1 min-h-0 flex flex-col mt-0 pt-3">
          <div className="flex items-center justify-between px-4 pb-3 shrink-0">
            <p className="text-xs text-muted-foreground">
              Found a problem? Report it so it can be fixed
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={fetchBugReports} className="gap-1.5 h-8">
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh
              </Button>
              <Button size="sm" onClick={() => setShowBugForm(true)} className="gap-1.5 h-8">
                <Plus className="w-3.5 h-3.5" />
                Report a Bug
              </Button>
            </div>
          </div>

          <ScrollArea className="flex-1 px-4">
            {loadingBugs ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : bugReports.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                <Bug className="w-10 h-10 mb-3 opacity-30" />
                <p className="text-sm font-medium">No bug reports yet</p>
                <p className="text-xs mt-1">All clear — or be the first to report!</p>
              </div>
            ) : (
              <div className="space-y-2 pb-6">
                {bugReports.map((b) => (
                  <div
                    key={b.id}
                    className="border border-border rounded-lg bg-card hover:bg-muted/30 transition-colors"
                  >
                    <button
                      className="w-full text-left p-4"
                      onClick={() => setExpandedBugId(expandedBugId === b.id ? null : b.id)}
                    >
                      <div className="flex items-start gap-3">
                        <Bug className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-medium text-sm text-foreground">{b.title}</span>
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full capitalize ${
                                SEVERITY_BADGES[b.severity] ?? SEVERITY_BADGES.medium
                              }`}
                            >
                              {b.severity}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full capitalize ${
                                STATUS_BADGES[b.status] ?? STATUS_BADGES.open
                              }`}
                            >
                              {b.status}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2">{b.description}</p>
                          <div className="text-[10px] text-muted-foreground/60 mt-1.5 flex gap-2">
                            <span>{b.author_name}</span>
                            <span>·</span>
                            <span>{formatDistanceToNow(new Date(b.created_at), { addSuffix: true })}</span>
                          </div>
                        </div>
                        {b.steps_to_reproduce && (
                          expandedBugId === b.id
                            ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                            : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                        )}
                      </div>
                    </button>
                    {expandedBugId === b.id && b.steps_to_reproduce && (
                      <div className="px-4 pb-4 border-t border-border/50">
                        <p className="text-xs font-semibold text-muted-foreground mt-3 mb-1.5">
                          Steps to Reproduce
                        </p>
                        <p className="text-xs text-foreground/80 whitespace-pre-wrap font-mono bg-muted/40 rounded p-2">
                          {b.steps_to_reproduce}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {/* ── New Suggestion Dialog ── */}
      <Dialog open={showSuggestionForm} onOpenChange={setShowSuggestionForm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-yellow-500" />
              New Feature Suggestion
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="sugg-title">Title</Label>
              <Input
                id="sugg-title"
                placeholder="Short, catchy description of your idea"
                value={suggTitle}
                onChange={e => setSuggTitle(e.target.value)}
                maxLength={100}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sugg-desc">Description</Label>
              <Textarea
                id="sugg-desc"
                placeholder="Describe your feature idea in detail..."
                value={suggDesc}
                onChange={e => setSuggDesc(e.target.value)}
                rows={4}
                maxLength={1000}
              />
              <p className="text-[10px] text-muted-foreground text-right">{suggDesc.length}/1000</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSuggestionForm(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitSuggestion} disabled={submittingSugg} className="gap-2">
              {submittingSugg && <Loader2 className="w-4 h-4 animate-spin" />}
              Post Suggestion
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── New Bug Report Dialog ── */}
      <Dialog open={showBugForm} onOpenChange={setShowBugForm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bug className="w-5 h-5 text-red-500" />
              Report a Bug
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="bug-title">Title</Label>
              <Input
                id="bug-title"
                placeholder="Brief summary of the bug"
                value={bugTitle}
                onChange={e => setBugTitle(e.target.value)}
                maxLength={100}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bug-severity">Severity</Label>
              <Select value={bugSeverity} onValueChange={setBugSeverity}>
                <SelectTrigger id="bug-severity">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low — Minor inconvenience</SelectItem>
                  <SelectItem value="medium">Medium — Affects usability</SelectItem>
                  <SelectItem value="high">High — Major feature broken</SelectItem>
                  <SelectItem value="critical">Critical — App crashes / data loss</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bug-desc">What happened?</Label>
              <Textarea
                id="bug-desc"
                placeholder="Describe the bug clearly..."
                value={bugDesc}
                onChange={e => setBugDesc(e.target.value)}
                rows={3}
                maxLength={1000}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bug-steps">
                Steps to Reproduce{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Textarea
                id="bug-steps"
                placeholder={"1. Open Config Editor\n2. Click save\n3. Error appears..."}
                value={bugSteps}
                onChange={e => setBugSteps(e.target.value)}
                rows={3}
                maxLength={2000}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBugForm(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitBug} disabled={submittingBug} className="gap-2">
              {submittingBug && <Loader2 className="w-4 h-4 animate-spin" />}
              Submit Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
