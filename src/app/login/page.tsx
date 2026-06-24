"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { toast } from "react-hot-toast";
import { loginWithEmailPassword } from "@verseye/auth-client";

const brandAssetPaths = {
    logo: "/images/aisleris-logo.svg",
    loginHero: "/images/login-hero.svg",
};

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
    left?: React.ReactNode;
    right?: React.ReactNode;
};

function Input({ left, right, className = "", ...props }: InputProps) {
    return (
        <div className="relative flex items-center">
            {left ? (
                <span className="pointer-events-none absolute left-3 flex items-center text-muted-foreground [&_svg]:size-5">
                    {left}
                </span>
            ) : null}
            <input
                {...props}
                className={`h-11 w-full rounded-md border border-input bg-card text-foreground shadow-sm transition placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring ${left ? "pl-10" : "pl-3"
                    } ${right ? "pr-10" : "pr-3"} ${className}`}
            />
            {right ? (
                <span className="absolute right-3 flex items-center text-muted-foreground [&_svg]:size-5">
                    {right}
                </span>
            ) : null}
        </div>
    );
}

function Button({ className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
    return (
        <button
            {...props}
            className={`inline-flex h-11 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
        />
    );
}

function OAuthButtons() {
    return (
        <div className="mt-8">
            <div className="mt-6 flex justify-center gap-4">
                <button
                    className="flex size-11 items-center justify-center rounded-full border border-border bg-card text-sm font-bold text-[#EA4335] shadow-sm transition hover:bg-muted"
                    onClick={() => toast("Connect Google OAuth")}>
                    G
                </button>
                <button
                    className="flex size-11 items-center justify-center rounded-full border border-border bg-card text-sm font-bold text-[#1877F2] shadow-sm transition hover:bg-muted"
                    onClick={() => toast("Connect Facebook OAuth")}>
                    f
                </button>
                <button
                    className="flex size-11 items-center justify-center rounded-full border border-border bg-card text-sm font-bold text-[#1DA1F2] shadow-sm transition hover:bg-muted"
                    onClick={() => toast("Connect Twitter OAuth")}>
                    𝕏
                </button>
            </div>
        </div>
    );
}

function LoginForm() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const router = useRouter();

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setSubmitting(true);

        try {
            const res = await loginWithEmailPassword({ email, password });

            if (!res.ok) {
                toast.error(res.message ?? "Sign-in failed");
                return;
            }

            toast.success(res.message ?? "Signed in");

            await new Promise((r) => setTimeout(r, 600));

            router.push("/");
            router.refresh();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Sign-in failed");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <>
            <form onSubmit={onSubmit} className="mt-14 space-y-5">
                <label className="grid gap-2 text-sm font-medium text-foreground">
                    <span>
                        Email Address <span className="text-red-500">*</span>
                    </span>
                    <Input
                        type="email"
                        autoComplete="username"
                        required
                        placeholder="Enter your email address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        left={<Mail />}
                    />
                </label>

                <label className="grid gap-2 text-sm font-medium text-foreground">
                    <span>
                        Password <span className="text-red-500">*</span>
                    </span>
                    <Input
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        required
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        left={<Lock />}
                        right={
                            <button
                                type="button"
                                onClick={() => setShowPassword((v) => !v)}
                                className="flex items-center text-muted-foreground transition hover:text-foreground"
                            >
                                {showPassword ? <EyeOff /> : <Eye />}
                            </button>
                        }
                    />
                </label>

                <Button type="submit" disabled={submitting} className="w-full">
                    {submitting ? "Signing in…" : "Sign In"}
                </Button>
            </form>

            <OAuthButtons />
        </>
    );
}

export default function LoginPage() {
    return (
        <div className="flex min-h-screen flex-col bg-background text-foreground transition-colors duration-200 lg:h-screen lg:flex-row lg:overflow-hidden">
            <div className="relative flex w-full flex-col justify-between border-border px-6 py-10 sm:px-10 lg:h-full lg:w-1/2 lg:overflow-y-auto lg:border-r lg:px-14 lg:py-12 xl:w-5/12 2xl:w-2/5">

                <div className="mx-auto my-auto w-full max-w-md">
                    <div className="flex flex-col items-center text-center mt-10">
                        <Image
                            src={brandAssetPaths.logo}
                            alt="AISLERIS"
                            width={222}
                            height={32}
                            priority
                            className="h-8 w-auto"
                        />
                        <p className="mt-4 text-sm text-muted-foreground">
                            Start your experience with AISLERIS by signing in.
                        </p>
                    </div>

                    <LoginForm />
                </div>

                <footer className="mx-auto mt-2 w-full max-w-md text-center text-xs text-muted-foreground">
                    <p>Copyright : AISLERIS, All Right Reserved</p>
                </footer>
            </div>

            <div className="relative hidden min-h-[420px] flex-1 lg:block">
                <Image
                    src={brandAssetPaths.loginHero}
                    alt=""
                    fill
                    priority
                    sizes="50vw"
                    className="object-cover object-right"
                />
            </div>
        </div>
    );
}
