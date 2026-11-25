"use client";

import { SignInForm } from "~/components/sign-in-form";

export function SignInScreen() {
  return (
    <div className="flex h-full flex-col justify-center px-6 py-8">
      <div className="mb-6 text-center">
        <h1 className="mb-1 font-semibold text-2xl/7 text-gray-900 tracking-tight md:text-3xl/9">
          Welcome to Carol
        </h1>
        <p className="text-gray-500 text-sm/6">Sign in to continue</p>
      </div>
      <SignInForm />
    </div>
  );
}
