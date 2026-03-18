import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

type SkillItem = {
  slug: string;
  name: string;
  category: string;
  description: string;
  version: string;
  installed: boolean;
  enabled: number;
  installedVersion: string | null;
  updateAvailable: boolean;
  updateTo: string | null;
  changelog?: string;
};

export function SkillStore() {
  const { t } = useTranslation("common");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<SkillItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingSlug, setLoadingSlug] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.slug.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q),
    );
  }, [items, query]);

  async function loadSkills(): Promise<void> {
    const coreUrl = await window.minitron.getCoreUrl();
    const response = await fetch(`${coreUrl}/skills`);
    if (!response.ok) {
      setError(t("skills.errorLoad"));
      return;
    }
    const payload = (await response.json()) as { items?: SkillItem[] };
    setItems(payload.items ?? []);
  }

  useEffect(() => {
    void loadSkills();
  }, []);

  async function install(slug: string): Promise<void> {
    setLoadingSlug(slug);
    const coreUrl = await window.minitron.getCoreUrl();
    const response = await fetch(`${coreUrl}/skills/install`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug }),
    });
    setLoadingSlug(null);
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      setError(payload.error ?? t("skills.errorInstall"));
      return;
    }
    setError(null);
    await loadSkills();
  }

  async function update(slug: string): Promise<void> {
    setLoadingSlug(slug);
    const coreUrl = await window.minitron.getCoreUrl();
    const response = await fetch(`${coreUrl}/skills/update`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug, approved: true }),
    });
    setLoadingSlug(null);
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      setError(payload.error ?? t("skills.errorUpdate"));
      return;
    }
    setError(null);
    await loadSkills();
  }

  return (
    <section className="p-4 space-y-3">
      <h2 className="font-semibold">{t("skills.title")}</h2>
      <input
        className="w-full border rounded px-2 py-1"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t("skills.searchPlaceholder")}
      />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="space-y-2">
        {filtered.map((skill) => (
          <article key={skill.slug} className="border rounded p-3">
            <p className="font-medium">{skill.name}</p>
            <p className="text-sm text-slate-600">{skill.description}</p>
            <p className="text-xs text-slate-500">
              {skill.category} - v{skill.version}
            </p>
            <div className="flex gap-2 mt-2">
              <span className="text-xs px-2 py-1 border rounded">
                {skill.installed ? t("skills.badgeInstalled") : t("skills.badgeNotInstalled")}
              </span>
              {skill.updateAvailable ? (
                <span className="text-xs px-2 py-1 border rounded">{t("skills.badgeUpdate")}</span>
              ) : null}
            </div>
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => void install(skill.slug)}
                disabled={loadingSlug === skill.slug || skill.installed}
              >
                {loadingSlug === skill.slug ? t("skills.loading") : t("skills.install")}
              </button>
              <button
                onClick={() => void update(skill.slug)}
                disabled={loadingSlug === skill.slug || !skill.updateAvailable}
              >
                {t("skills.update")}
              </button>
            </div>
          </article>
        ))}
        {filtered.length === 0 ? <p className="text-sm text-slate-500">{t("skills.empty")}</p> : null}
      </div>
    </section>
  );
}
