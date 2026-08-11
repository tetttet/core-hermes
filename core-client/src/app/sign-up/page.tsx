import type { Metadata } from "next";
import { AuthPage } from "@/components/auth/auth-page";

export const metadata: Metadata = { title: "Регистрация — Hermes" };

export default function SignUpPage() {
  return <AuthPage mode="signup" />;
}
