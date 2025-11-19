"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ShieldCheck } from "lucide-react";
import { signInWithEmailPasswordAndMfa } from "@/auth/authHelper";
import { useToast } from "@/hooks/use-toast";

export function VerifiersLogin() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [needsMfa, setNeedsMfa] = useState(false);
  const [mfaCode, setMfaCode] = useState("");

  // Function to get MFA code from user
  const getMfaCode = () => {
    return new Promise((resolve) => {
      setNeedsMfa(true);
      // Store the resolve function to be called when user submits MFA code
      window.resolveMfaCode = resolve;
    });
  };

  const handleMfaSubmit = (e) => {
    e.preventDefault();
    if (window.resolveMfaCode) {
      window.resolveMfaCode(mfaCode);
      delete window.resolveMfaCode;
      setNeedsMfa(false);
      setMfaCode("");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Add reCAPTCHA container for MFA
      if (!document.getElementById("recaptcha-container")) {
        const recaptchaDiv = document.createElement("div");
        recaptchaDiv.id = "recaptcha-container";
        document.body.appendChild(recaptchaDiv);
      }

      const user = await signInWithEmailPasswordAndMfa(
        email,
        password,
        getMfaCode
      );

      toast({
        title: "Login successful",
        description: `Welcome back, ${user.email}`,
      });
    } catch (err) {
      console.error("Login error:", err.code); // Log error code for debugging, not message

      // Generic error messages to avoid exposing system details
      const getGenericError = (errorCode) => {
        const genericErrors = {
          "auth/user-not-found": "Invalid credentials. Please try again.",
          "auth/wrong-password": "Invalid credentials. Please try again.",
          "auth/invalid-credential": "Invalid credentials. Please try again.",
          "auth/invalid-email": "Please enter a valid email address.",
          "auth/user-disabled": "This account has been disabled.",
          "auth/too-many-requests":
            "Too many failed attempts. Please try again later.",
          "auth/network-request-failed":
            "Network error. Please check your connection.",
        };
        return genericErrors[errorCode] || "Login failed. Please try again.";
      };

      const genericMessage = getGenericError(err.code);
      setError(genericMessage);
      toast({
        title: "Login failed",
        description: genericMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (needsMfa) {
    return (
      <main className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1 text-center">
            <div className="flex justify-center mb-2">
              <ShieldCheck className="w-12 h-12 text-primary" />
            </div>
            <CardTitle className="text-2xl">
              Two-Factor Authentication
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleMfaSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="mfaCode">Verification Code</Label>
                <Input
                  id="mfaCode"
                  type="text"
                  placeholder="Enter code from SMS"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <Button type="submit" className="w-full" disabled={!mfaCode}>
                Verify
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex-1 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-2">
            <ShieldCheck className="w-12 h-12 text-primary" />
          </div>
          <CardTitle className="text-2xl">Verifiers Login</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="verifier@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
