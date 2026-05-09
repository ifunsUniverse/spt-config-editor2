import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Plus, ThumbsUp, Bug, Lightbulb, Loader2, RefreshCw, Trash2, Eye, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";

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

const BUG_REPORTS_PER_PAGE = 8;

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

const MOCK_BUG_REPORTS = [
  {
    title: "Config editor search stops responding",
    description: "Typing into the config search box stops filtering fields after switching between mods a few times.",
    steps_to_reproduce: "1. Open Config Editor\n2. Switch between 3 different mods\n3. Use search repeatedly\n4. Notice results stop updating",
    severity: "high",
    author_name: "Mason Reed",
    status: "open",
  },
  {
    title: "Community board refresh duplicates rows",
    description: "Refreshing the bug board quickly after posting can briefly show duplicate rows before the list settles.",
    steps_to_reproduce: "1. Submit a bug report\n2. Immediately click Refresh multiple times\n3. Watch the list for duplicate entries",
    severity: "medium",
    author_name: "Olivia Chen",
    status: "in-progress",
  },
  {
    title: "Export modal progress text overflows",
    description: "Long file names in the export progress dialog overflow the container on smaller window widths.",
    steps_to_reproduce: "1. Resize window to a narrow width\n2. Start export with a long file name\n3. Observe the progress line wrapping badly",
    severity: "low",
    author_name: "Noah Patel",
    status: "resolved",
  },
  {
    title: "App hangs when reopening last folder",
    description: "On some launches the app becomes unresponsive for several seconds while restoring the previous SPT folder.",
    steps_to_reproduce: "1. Enable auto-load last folder\n2. Close the app with a large mod list loaded\n3. Reopen the app\n4. Watch for delayed UI response",
    severity: "critical",
    author_name: "Ava Martinez",
    status: "open",
  },
] as const;

const MOCK_SUGGESTIONS = [
  {
    title: "Bulk enable or disable mods",
    description: "Add a quick action to enable or disable multiple mods at once from the sidebar.",
    author_name: "Ethan Brooks",
    votes: 14,
  },
  {
    title: "Search across every config file",
    description: "Let users search values and keys across all scanned configs instead of only the open mod.",
    author_name: "Sophia Kim",
    votes: 22,
  },
  {
    title: "Diff view before saving",
    description: "Show a before and after diff so changes are easier to review before writing files.",
    author_name: "Liam Walker",
    votes: 19,
  },
  {
    title: "Favorite config tabs",
    description: "Allow certain config files to be pinned so they always open first for a mod.",
    author_name: "Harper Singh",
    votes: 9,
  },
  {
    title: "Import and export category presets",
    description: "Make it possible to share category setups between installs and friends.",
    author_name: "Lucas Price",
    votes: 11,
  },
  {
    title: "Live validation sidebar",
    description: "Show validation errors in a side panel that updates while editing instead of only on save.",
    author_name: "Isabella Young",
    votes: 27,
  },
] as const;

export const CommunityHub = ({ onBack }: CommunityHubProps) => {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [bugReports, setBugReports] = useState<BugReport[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);
  const [loadingBugs, setLoadingBugs] = useState(true);
  const [votedIds, setVotedIds] = useState<Set<string>>(getVotedSet);
  const [votingId, setVotingId] = useState<string | null>(null);
  const [deletingSuggestionId, setDeletingSuggestionId] = useState<string | null>(null);
  const [deletingBugId, setDeletingBugId] = useState<string | null>(null);
  const [deletingAllSuggestions, setDeletingAllSuggestions] = useState(false);
  const [deletingAllBugs, setDeletingAllBugs] = useState(false);
  const [confirmDeleteSuggestionId, setConfirmDeleteSuggestionId] = useState<string | null>(null);
  const [confirmDeleteBugId, setConfirmDeleteBugId] = useState<string | null>(null);
  const [confirmDeleteAllSuggestions, setConfirmDeleteAllSuggestions] = useState(false);
  const [confirmDeleteAllBugs, setConfirmDeleteAllBugs] = useState(false);
  const [selectedBugId, setSelectedBugId] = useState<string | null>(null);
  const [currentBugPage, setCurrentBugPage] = useState(1);
  const [simulatingActivity, setSimulatingActivity] = useState(false);

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
      setCurrentBugPage(1);
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

  const bugPageCount = Math.max(1, Math.ceil(bugReports.length / BUG_REPORTS_PER_PAGE));
  const bugPageStartIndex = (currentBugPage - 1) * BUG_REPORTS_PER_PAGE;
  const paginatedBugReports = bugReports.slice(bugPageStartIndex, bugPageStartIndex + BUG_REPORTS_PER_PAGE);

  useEffect(() => {
    setCurrentBugPage((prev) => Math.min(prev, bugPageCount));
  }, [bugPageCount]);

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

  const submitSuggestion = async (payload: {
    title: string;
    description: string;
    author_name?: string;
    votes?: number;
  }) => {
    const { data, error } = await (supabase as any)
      .from("suggestions")
      .insert({
        title: payload.title,
        description: payload.description,
        author_name: payload.author_name ?? "Anonymous",
        votes: payload.votes ?? 0,
      })
      .select()
      .single();

    if (error) throw error;

    setSuggestions((prev) => [...prev, data].sort((a, b) => b.votes - a.votes));
  };

  const handleSubmitSuggestion = async () => {
    if (!suggTitle.trim() || !suggDesc.trim()) {
      toast.error("Please fill in all fields");
      return;
    }
    setSubmittingSugg(true);
    try {
      await submitSuggestion({
        title: suggTitle.trim(),
        description: suggDesc.trim(),
      });
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

  const submitBugReport = async (payload: {
    title: string;
    description: string;
    steps_to_reproduce?: string | null;
    severity: string;
    author_name?: string;
    status?: string;
  }) => {
    const { data, error } = await (supabase as any)
      .from("bug_reports")
      .insert({
        title: payload.title,
        description: payload.description,
        steps_to_reproduce: payload.steps_to_reproduce ?? null,
        severity: payload.severity,
        author_name: payload.author_name ?? "Anonymous",
        status: payload.status ?? "open",
      })
      .select()
      .single();

    if (error) throw error;
    setBugReports(prev => [data, ...prev]);
  };

  const handleSubmitBug = async () => {
    if (!bugTitle.trim() || !bugDesc.trim()) {
      toast.error("Please fill in all fields");
      return;
    }
    setSubmittingBug(true);
    try {
      await submitBugReport({
        title: bugTitle.trim(),
        description: bugDesc.trim(),
        steps_to_reproduce: bugSteps.trim() || null,
        severity: bugSeverity,
      });
      setCurrentBugPage(1);
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

  const handleSubmitMockBug = async () => {
    if (submittingBug) return;

    const mockBug = MOCK_BUG_REPORTS[Math.floor(Math.random() * MOCK_BUG_REPORTS.length)];
    setSubmittingBug(true);
    try {
      await submitBugReport({
        title: mockBug.title,
        description: mockBug.description,
        steps_to_reproduce: mockBug.steps_to_reproduce,
        severity: mockBug.severity,
        author_name: mockBug.author_name,
        status: mockBug.status,
      });
      setCurrentBugPage(1);
      toast.success("Mock bug report submitted!");
    } catch (error) {
      console.error("Failed to submit mock bug report:", error);
      toast.error(`Failed to submit mock bug report: ${getErrorMessage(error)}`);
    } finally {
      setSubmittingBug(false);
    }
  };

  const handleSimulateActivity = async () => {
    if (simulatingActivity || submittingSugg || submittingBug) return;

    setSimulatingActivity(true);
    try {
      const { error: suggestionsError } = await (supabase as any)
        .from("suggestions")
        .insert(MOCK_SUGGESTIONS.map((suggestion) => ({
          title: suggestion.title,
          description: suggestion.description,
          author_name: suggestion.author_name,
          votes: suggestion.votes,
        })));

      if (suggestionsError) throw suggestionsError;

      const { error: bugsError } = await (supabase as any)
        .from("bug_reports")
        .insert(MOCK_BUG_REPORTS.map((bug) => ({
          title: bug.title,
          description: bug.description,
          steps_to_reproduce: bug.steps_to_reproduce,
          severity: bug.severity,
          author_name: bug.author_name,
          status: bug.status,
        })));

      if (bugsError) throw bugsError;

      await Promise.all([fetchSuggestions(), fetchBugReports()]);
      toast.success("Demo user activity added!");
    } catch (error) {
      console.error("Failed to simulate community activity:", error);
      toast.error(`Failed to simulate community activity: ${getErrorMessage(error)}`);
    } finally {
      setSimulatingActivity(false);
    }
  };

  const handleDeleteSuggestion = async (id: string) => {
    if (deletingSuggestionId || deletingAllSuggestions || votingId) return;
    setDeletingSuggestionId(id);
    try {
      const { error } = await (supabase as any)
        .from("suggestions")
        .delete()
        .eq("id", id);
      if (error) throw error;

      const nextVotes = new Set(votedIds);
      nextVotes.delete(id);
      setVotedIds(nextVotes);
      saveVotedSet(nextVotes);
      setSuggestions((prev) => prev.filter((s) => s.id !== id));
      toast.success("Suggestion deleted");
    } catch (error) {
      console.error("Failed to delete suggestion:", error);
      toast.error(`Failed to delete suggestion: ${getErrorMessage(error)}`);
    } finally {
      setDeletingSuggestionId(null);
    }
  };

  const handleDeleteAllSuggestions = async () => {
    if (deletingAllSuggestions || suggestions.length === 0) return;

    setDeletingAllSuggestions(true);
    try {
      const suggestionIds = suggestions.map((suggestion) => suggestion.id);
      const { error } = await (supabase as any)
        .from("suggestions")
        .delete()
        .in("id", suggestionIds);

      if (error) throw error;

      setSuggestions([]);
      const nextVotes = new Set(votedIds);
      suggestionIds.forEach((id) => nextVotes.delete(id));
      setVotedIds(nextVotes);
      saveVotedSet(nextVotes);
      toast.success("All suggestions deleted");
    } catch (error) {
      console.error("Failed to delete all suggestions:", error);
      toast.error(`Failed to delete all suggestions: ${getErrorMessage(error)}`);
    } finally {
      setDeletingAllSuggestions(false);
    }
  };

  const handleDeleteBugReport = async (id: string) => {
    if (deletingBugId || deletingAllBugs) return;
    setDeletingBugId(id);
    try {
      const { error } = await (supabase as any)
        .from("bug_reports")
        .delete()
        .eq("id", id);
      if (error) throw error;

      setBugReports((prev) => prev.filter((b) => b.id !== id));
      setSelectedBugId((prev) => (prev === id ? null : prev));
      toast.success("Bug report deleted");
    } catch (error) {
      console.error("Failed to delete bug report:", error);
      toast.error(`Failed to delete bug report: ${getErrorMessage(error)}`);
    } finally {
      setDeletingBugId(null);
    }
  };

  const handleDeleteAllBugReports = async () => {
    if (deletingAllBugs || bugReports.length === 0) return;

    setDeletingAllBugs(true);
    try {
      const bugIds = bugReports.map((bug) => bug.id);
      const { error } = await (supabase as any)
        .from("bug_reports")
        .delete()
        .in("id", bugIds);

      if (error) throw error;

      setBugReports([]);
      setSelectedBugId(null);
      setCurrentBugPage(1);
      toast.success("All bug reports deleted");
    } catch (error) {
      console.error("Failed to delete all bug reports:", error);
      toast.error(`Failed to delete all bug reports: ${getErrorMessage(error)}`);
    } finally {
      setDeletingAllBugs(false);
    }
  };

  const suggestionToConfirmDelete =
    confirmDeleteSuggestionId ? suggestions.find((s) => s.id === confirmDeleteSuggestionId) : null;
  const bugToConfirmDelete =
    confirmDeleteBugId ? bugReports.find((b) => b.id === confirmDeleteBugId) : null;
  const selectedBugReport = selectedBugId ? bugReports.find((b) => b.id === selectedBugId) : null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
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
        <Button
          variant="outline"
          size="sm"
          onClick={handleSimulateActivity}
          disabled={simulatingActivity || submittingSugg || submittingBug}
          className="gap-2"
        >
          {simulatingActivity ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
          Simulate Activity
        </Button>
      </div>

      {/* Tabs */}
      <main className="flex-1 w-full px-4 py-4 box-border">
        <Tabs defaultValue="suggestions" className="flex w-full flex-col">
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
        {/* ── Suggestions Tab ── */}
        <TabsContent value="suggestions" className="m-0 mt-4 flex flex-col">
          <div className="flex items-center justify-between pb-3">
            <p className="text-xs text-muted-foreground">
              Upvote ideas you love — top ideas get implemented first
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmDeleteAllSuggestions(true)}
                disabled={deletingAllSuggestions || suggestions.length === 0}
                className="gap-1.5 h-8"
              >
                {deletingAllSuggestions ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Delete All Suggestions
              </Button>
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

          <ScrollArea className="w-full box-border">
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
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleVote(s)}
                              disabled={hasVoted || !!votingId || deletingSuggestionId === s.id}
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
                            <button
                              onClick={() => setConfirmDeleteSuggestionId(s.id)}
                              disabled={deletingSuggestionId === s.id || !!votingId}
                              title="Delete suggestion"
                              className="flex items-center justify-center px-2 py-1.5 rounded-md text-foreground/60 hover:text-destructive hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                            >
                              {deletingSuggestionId === s.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Trash2 className="w-3 h-3" />
                              )}
                            </button>
                          </div>
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
        <TabsContent value="bugs" className="m-0 mt-4 flex flex-1 flex-col">
          <div className="flex flex-1 flex-col w-full max-w-full box-border pb-4">
            <div className="flex flex-1 flex-col w-full max-w-full box-border rounded-xl border border-border/70 bg-[radial-gradient(80%_140%_at_0%_0%,rgba(59,130,246,0.12),transparent_60%),radial-gradient(80%_140%_at_100%_0%,rgba(14,165,233,0.08),transparent_60%)]">
              <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border/70 px-4 py-4">
                <div>
                  <h2 className="text-xl font-semibold text-foreground">Bug Reports</h2>
                  <p className="text-sm text-muted-foreground">View and manage reported bugs.</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmDeleteAllBugs(true)}
                    disabled={deletingAllBugs || bugReports.length === 0}
                    className="gap-1.5 h-9"
                  >
                    {deletingAllBugs ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    Delete All Reports
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSubmitMockBug}
                    disabled={submittingBug}
                    className="gap-1.5 h-9"
                  >
                    {submittingBug ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bug className="w-4 h-4" />}
                    Add Mock Bug Report
                  </Button>
                  <Button variant="outline" size="sm" onClick={fetchBugReports} className="gap-1.5 h-9">
                    <RefreshCw className="w-4 h-4" />
                    Refresh
                  </Button>
                  <Button size="sm" onClick={() => setShowBugForm(true)} className="gap-1.5 h-9">
                    <Plus className="w-4 h-4" />
                    Report a Bug
                  </Button>
                </div>
              </div>

              <div className="flex-1 w-full max-w-full box-border p-4">
                {loadingBugs ? (
                  <div className="flex min-h-[260px] items-center justify-center">
                    <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
                  </div>
                ) : bugReports.length === 0 ? (
                  <div className="flex min-h-[260px] flex-col items-center justify-center text-center text-muted-foreground">
                    <Bug className="mb-3 h-10 w-10 opacity-30" />
                    <p className="text-base font-medium">No bug reports yet</p>
                    <p className="mt-1 text-sm">All clear - or be the first to report.</p>
                  </div>
                ) : (
                  <>
                    <div className="hidden md:block">
                        <div className="w-full overflow-x-auto rounded-lg border border-border/70 bg-background/40">
                        <div className="grid grid-cols-[120px_minmax(260px,1.9fr)_140px_180px_170px_180px] gap-4 border-b border-border/70 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          <div>ID</div>
                          <div>Title</div>
                          <div>Status</div>
                          <div>Reported By</div>
                          <div>Date Reported</div>
                          <div>Actions</div>
                        </div>

                        {paginatedBugReports.map((b, idx) => {
                          const rowId = `BUG-${new Date(b.created_at).getFullYear()}-${String(bugPageStartIndex + idx + 1).padStart(3, "0")}`;
                          const initials = (b.author_name || "AN")
                            .split(" ")
                            .map((part) => part[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase();
                          return (
                            <div
                              key={b.id}
                              className="grid grid-cols-[120px_minmax(260px,1.9fr)_140px_180px_170px_180px] gap-4 border-b border-border/50 px-4 py-3 last:border-b-0 hover:bg-muted/20"
                            >
                              <div className="text-sm font-medium text-foreground/85">{rowId}</div>

                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-foreground">{b.title}</p>
                                <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{b.description}</p>
                              </div>

                              <div>
                                <span
                                  className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold capitalize ${
                                    STATUS_BADGES[b.status] ?? STATUS_BADGES.open
                                  }`}
                                >
                                  {b.status}
                                </span>
                              </div>

                              <div className="flex items-center gap-2">
                                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary">
                                  {initials}
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium text-foreground">{b.author_name}</p>
                                  <p className="text-xs text-muted-foreground">{b.severity}</p>
                                </div>
                              </div>

                              <div>
                                <p className="text-sm font-medium text-foreground">{format(new Date(b.created_at), "MMM d, yyyy")}</p>
                                <p className="text-xs text-muted-foreground">{format(new Date(b.created_at), "hh:mm a")}</p>
                              </div>

                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setSelectedBugId(b.id)}
                                  className="h-8 gap-1.5"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                  View Details
                                </Button>
                                <button
                                  onClick={() => setConfirmDeleteBugId(b.id)}
                                  disabled={deletingBugId === b.id || deletingAllBugs}
                                  title="Delete bug report"
                                  className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                                >
                                  {deletingBugId === b.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-3 md:hidden">
                      {paginatedBugReports.map((b, idx) => {
                        const rowId = `BUG-${new Date(b.created_at).getFullYear()}-${String(bugPageStartIndex + idx + 1).padStart(3, "0")}`;
                        return (
                          <div key={b.id} className="rounded-lg border border-border/70 bg-background/40 p-3">
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <p className="text-xs font-semibold tracking-wide text-muted-foreground">{rowId}</p>
                              <span
                                className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold capitalize ${
                                  STATUS_BADGES[b.status] ?? STATUS_BADGES.open
                                }`}
                              >
                                {b.status}
                              </span>
                            </div>
                            <p className="text-sm font-semibold text-foreground">{b.title}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{b.description}</p>
                            <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                              <span>{formatDistanceToNow(new Date(b.created_at), { addSuffix: true })}</span>
                              <span className="capitalize">{b.severity}</span>
                            </div>
                            <div className="mt-3 flex items-center gap-2">
                              <Button variant="outline" size="sm" className="h-8 flex-1 gap-1.5" onClick={() => setSelectedBugId(b.id)}>
                                <Eye className="h-3.5 w-3.5" />
                                View
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8"
                                onClick={() => setConfirmDeleteBugId(b.id)}
                                disabled={deletingBugId === b.id || deletingAllBugs}
                              >
                                {deletingBugId === b.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-3 flex flex-col gap-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        Showing {bugReports.length === 0 ? 0 : bugPageStartIndex + 1} to {Math.min(bugPageStartIndex + BUG_REPORTS_PER_PAGE, bugReports.length)} of {bugReports.length} results
                      </div>
                      {bugPageCount > 1 && (
                        <Pagination className="mx-0 w-auto justify-start sm:justify-end">
                          <PaginationContent>
                            <PaginationItem>
                              <PaginationPrevious
                                href="#"
                                onClick={(event) => {
                                  event.preventDefault();
                                  setCurrentBugPage((prev) => Math.max(1, prev - 1));
                                }}
                                className={currentBugPage === 1 ? "pointer-events-none opacity-50" : ""}
                              />
                            </PaginationItem>
                            {Array.from({ length: bugPageCount }, (_, index) => index + 1).map((page) => (
                              <PaginationItem key={page}>
                                <PaginationLink
                                  href="#"
                                  isActive={page === currentBugPage}
                                  onClick={(event) => {
                                    event.preventDefault();
                                    setCurrentBugPage(page);
                                  }}
                                >
                                  {page}
                                </PaginationLink>
                              </PaginationItem>
                            ))}
                            <PaginationItem>
                              <PaginationNext
                                href="#"
                                onClick={(event) => {
                                  event.preventDefault();
                                  setCurrentBugPage((prev) => Math.min(bugPageCount, prev + 1));
                                }}
                                className={currentBugPage === bugPageCount ? "pointer-events-none opacity-50" : ""}
                              />
                            </PaginationItem>
                          </PaginationContent>
                        </Pagination>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </TabsContent>
        </Tabs>
      </main>

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

      <Dialog
        open={Boolean(selectedBugId)}
        onOpenChange={(open) => {
          if (!open) setSelectedBugId(null);
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bug className="h-5 w-5 text-red-500" />
              {selectedBugReport?.title ?? "Bug Details"}
            </DialogTitle>
          </DialogHeader>
          {selectedBugReport && (
            <div className="space-y-4 py-1">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold capitalize ${
                    STATUS_BADGES[selectedBugReport.status] ?? STATUS_BADGES.open
                  }`}
                >
                  {selectedBugReport.status}
                </span>
                <span
                  className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold capitalize ${
                    SEVERITY_BADGES[selectedBugReport.severity] ?? SEVERITY_BADGES.medium
                  }`}
                >
                  {selectedBugReport.severity}
                </span>
                <span className="text-xs text-muted-foreground">
                  Reported by {selectedBugReport.author_name} • {formatDistanceToNow(new Date(selectedBugReport.created_at), { addSuffix: true })}
                </span>
              </div>

              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Description</p>
                <p className="rounded-md border border-border/70 bg-muted/30 p-3 text-sm text-foreground whitespace-pre-wrap">
                  {selectedBugReport.description}
                </p>
              </div>

              {selectedBugReport.steps_to_reproduce && (
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Steps to Reproduce</p>
                  <p className="rounded-md border border-border/70 bg-muted/30 p-3 font-mono text-xs text-foreground whitespace-pre-wrap">
                    {selectedBugReport.steps_to_reproduce}
                  </p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedBugId(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={confirmDeleteAllSuggestions}
        onOpenChange={(open) => {
          if (!open) setConfirmDeleteAllSuggestions(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete all suggestions?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all {suggestions.length} suggestion{suggestions.length === 1 ? "" : "s"}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingAllSuggestions}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deletingAllSuggestions || suggestions.length === 0}
              onClick={(event) => {
                event.preventDefault();
                setConfirmDeleteAllSuggestions(false);
                void handleDeleteAllSuggestions();
              }}
            >
              {deletingAllSuggestions ? "Deleting..." : "Delete All"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={confirmDeleteAllBugs}
        onOpenChange={(open) => {
          if (!open) setConfirmDeleteAllBugs(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete all bug reports?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all {bugReports.length} bug report{bugReports.length === 1 ? "" : "s"}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingAllBugs}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deletingAllBugs || bugReports.length === 0}
              onClick={(event) => {
                event.preventDefault();
                setConfirmDeleteAllBugs(false);
                void handleDeleteAllBugReports();
              }}
            >
              {deletingAllBugs ? "Deleting..." : "Delete All"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(confirmDeleteSuggestionId)}
        onOpenChange={(open) => {
          if (!open) setConfirmDeleteSuggestionId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete suggestion?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete
              {suggestionToConfirmDelete ? ` "${suggestionToConfirmDelete.title}"` : " this suggestion"}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(deletingSuggestionId)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={!confirmDeleteSuggestionId || Boolean(deletingSuggestionId)}
              onClick={(event) => {
                event.preventDefault();
                if (!confirmDeleteSuggestionId) return;
                const id = confirmDeleteSuggestionId;
                setConfirmDeleteSuggestionId(null);
                void handleDeleteSuggestion(id);
              }}
            >
              {deletingSuggestionId ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(confirmDeleteBugId)}
        onOpenChange={(open) => {
          if (!open) setConfirmDeleteBugId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete bug report?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete
              {bugToConfirmDelete ? ` "${bugToConfirmDelete.title}"` : " this bug report"}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(deletingBugId)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={!confirmDeleteBugId || Boolean(deletingBugId)}
              onClick={(event) => {
                event.preventDefault();
                if (!confirmDeleteBugId) return;
                const id = confirmDeleteBugId;
                setConfirmDeleteBugId(null);
                void handleDeleteBugReport(id);
              }}
            >
              {deletingBugId ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
