import { FormEvent, useMemo, useState } from "react";
import { ShieldCheck, LogIn, UserPlus } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/integrations/supabase/AuthProvider";
import { toast } from "sonner";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,24}$/;

function validateEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email);
}

const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "tempmail.com",
  "10minutemail.com",
  "guerrillamail.com",
  "yopmail.com",
  "throwawaymail.com",
  "fakeinbox.com",
  "sharklasers.com",
  "getairmail.com",
  "burnermail.io",
  "temp-mail.org",
  "mailnesia.com",
]);

function isDisposableEmail(email: string): boolean {
  const domain = email.split("@")[1];
  if (!domain) return false;
  return DISPOSABLE_DOMAINS.has(domain.toLowerCase());
}

export const AuthScreen = () => {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const trimmedUsername = useMemo(() => username.trim(), [username]);
  const trimmedEmail = useMemo(() => email.trim().toLowerCase(), [email]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!validateEmail(trimmedEmail)) {
      toast.error("Enter a valid email address.");
      return;
    }

    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }

    if (mode === "signup" && password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

<<<<<<< HEAD
    if (mode === "signup" && !USERNAME_PATTERN.test(trimmedUsername)) {
      toast.error("Username must be 3-24 characters and use only letters, numbers, or underscores.");
=======
    if (mode === "signup" && isDisposableEmail(trimmedEmail)) {
      toast.error("Disposable email addresses are not allowed.");
>>>>>>> fab456858afb6ba7909cfa225427aee1c45b8a1c
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "login") {
        const { error } = await signIn(trimmedEmail, password);
        if (error) {
          toast.error(error);
          return;
        }
        toast.success("Signed in.");
        return;
      }

      const { error, needsEmailVerification } = await signUp(trimmedEmail, password, trimmedUsername);
      if (error) {
        toast.error(error);
        return;
      }

      if (needsEmailVerification) {
        toast.success("Account created. Check your email to verify your account.");
        setMode("login");
      } else {
        toast.success("Account created and signed in.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      <div className="pointer-events-none absolute inset-0 opacity-80">
        <div className="absolute -top-16 left-8 h-72 w-72 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute top-20 right-6 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
      </div>

      <Card className="relative z-10 w-full max-w-md border-border/70 bg-card/85 backdrop-blur-xl">
        <CardHeader>
          <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <CardTitle className="text-2xl">Sign In Required</CardTitle>
          <CardDescription>
            Authenticate with your account to access the config editor and community tools.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Tabs value={mode} onValueChange={(value) => setMode(value as "login" | "signup")} className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login" className="gap-1.5">
                <LogIn className="h-4 w-4" /> Login
              </TabsTrigger>
              <TabsTrigger value="signup" className="gap-1.5">
                <UserPlus className="h-4 w-4" /> Sign Up
              </TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="mt-0">
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-1.5">
                  <Label htmlFor="auth-email-login">Email</Label>
                  <Input
                    id="auth-email-login"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    disabled={submitting}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="auth-password-login">Password</Label>
                  <Input
                    id="auth-password-login"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    disabled={submitting}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? "Signing In..." : "Sign In"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-0">
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-1.5">
                  <Label htmlFor="auth-username-signup">Username</Label>
                  <Input
                    id="auth-username-signup"
                    type="text"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="your_name"
                    disabled={submitting}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="auth-email-signup">Email</Label>
                  <Input
                    id="auth-email-signup"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    disabled={submitting}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="auth-password-signup">Password</Label>
                  <Input
                    id="auth-password-signup"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    disabled={submitting}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="auth-confirm-password-signup">Confirm Password</Label>
                  <Input
                    id="auth-confirm-password-signup"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    disabled={submitting}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? "Creating Account..." : "Create Account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};
