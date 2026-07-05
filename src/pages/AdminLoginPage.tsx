import { useMutation } from "@tanstack/react-query";
import { LockKeyhole } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signInStaff } from "../lib/data";
import { useLanguage } from "../lib/use-language";

export function AdminLoginPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const mutation = useMutation({
    mutationFn: () => signInStaff(email, password),
    onSuccess: () => navigate("/admin")
  });

  return (
    <section className="mx-auto grid max-w-5xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_420px] lg:px-8">
      <div className="flex flex-col justify-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-wave-deep">{t("admin.login.eyebrow")}</p>
        <h1 className="mt-2 text-4xl font-black">{t("admin.login.title")}</h1>
        <p className="mt-4 max-w-xl text-wave-ink/70">
          {t("admin.login.copy")}
        </p>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate();
        }}
        className="rounded-3xl border border-wave-deep/10 bg-white p-6"
      >
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-wave-mint text-wave-deep">
          <LockKeyhole />
        </div>
        <label className="block">
          <span className="mb-2 block text-sm font-semibold">{t("admin.login.email")}</span>
          <input className="focus-ring w-full rounded-xl border border-wave-deep/15 px-3 py-3" value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label className="mt-4 block">
          <span className="mb-2 block text-sm font-semibold">{t("admin.login.password")}</span>
          <input className="focus-ring w-full rounded-xl border border-wave-deep/15 px-3 py-3" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        {mutation.error && <p className="mt-4 rounded-xl bg-wave-deep/10 p-3 text-sm text-wave-deep">{mutation.error.message}</p>}
        <button type="submit" className="focus-ring mt-6 w-full rounded-full bg-wave-deep px-5 py-3 font-semibold text-white">
          {mutation.isPending ? t("admin.login.signingIn") : t("admin.login.signIn")}
        </button>
      </form>
    </section>
  );
}
