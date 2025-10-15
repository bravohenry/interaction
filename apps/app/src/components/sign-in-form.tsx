"use client";

import { useMutation } from "@tanstack/react-query";
import { BiLogoGoogle } from "react-icons/bi";
import { authClient } from "~/lib/auth-client";

export function SignInForm() {
  const signInWithGoogle = async () =>
    await authClient.signIn.social({
      provider: "google",
      callbackURL: "/",
    });

  const {
    mutate: handleGoogleSignIn,
    isPending,
    error,
  } = useMutation({
    mutationFn: signInWithGoogle,
  });

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-xl bg-destructive/10 p-3 text-destructive text-sm/6">
          {error.message}
        </div>
      )}

      <button
        className="inline-flex h-12 w-full items-center justify-center rounded-full bg-black px-5 font-medium text-base/6 text-white shadow-black/10 shadow-lg transition-colors hover:bg-black/90 focus:outline-hidden focus:ring-3 focus:ring-black focus:ring-offset-2 active:translate-y-px"
        disabled={isPending}
        onClick={() => handleGoogleSignIn()}
        type="button"
      >
        <BiLogoGoogle className="size-5" />
        {isPending ? "Signing in..." : "Continue with Google"}
      </button>
    </div>
  );
}
